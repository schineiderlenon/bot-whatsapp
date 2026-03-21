require('dotenv').config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

// Configurações
const { 
    OPENAI_API_KEY, ZAPI_TOKEN, ZAPI_INSTANCE, MONGODB_URI,
    GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY 
} = process.env;

const MEU_CLIENT_TOKEN = "F9bbdcb6281e64e6b83211233911df38cS";

// 1. Conexão MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log("MongoDB Conectado! 🧠"))
  .catch(err => console.error("Erro MongoDB:", err));

const Message = mongoose.model("Message", new mongoose.Schema({
    phone: String, role: String, content: String,
    createdAt: { type: Date, default: Date.now, expires: 86400 }
}));

// 2. Configuração Google Sheets
const serviceAccountAuth = new JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function salvarNaPlanilha(dados) {
    try {
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        // Identifica o mês atual para escolher a aba (Ex: JAN, FEV, MAR)
        const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
        const mesAtual = meses[new Date().getMonth()]; 
        const sheet = doc.sheetsByTitle[mesAtual];

        if (!sheet) throw new Error(`Aba ${mesAtual} não encontrada!`);

        await sheet.addRow({ 
            "Tipo": dados.tipo,
            "Categoria": dados.categoria, 
            "Observações": dados.observacao, 
            "Valor": dados.valor, 
            "Forma": dados.forma, 
            "Cartão de crédito": dados.cartao || "", 
            "Nº da parcela": "1/1",
            "Data vencimento": dados.data,
            "Data pagamento": dados.data,
            "Status": "Pago"
        });
        return true;
    } catch (err) {
        console.error("Erro ao salvar na planilha:", err.message);
        return false;
    }
}

// 3. Webhook Principal
app.post("/webhook", async (req, res) => {
    const { isGroup, text, phone } = req.body;
    const userMessage = text?.message;

    if (isGroup || !userMessage || !phone) return res.sendStatus(200);

    try {
        // Salva mensagem do usuário e busca histórico
        await Message.create({ phone, role: "user", content: userMessage });
        const history = await Message.find({ phone }).sort({ createdAt: -1 }).limit(6);
        const chatContext = history.reverse().map(m => ({ role: m.role, content: m.content }));

        // Chamada OpenAI com Instruções de Classificação
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [
                { 
                    role: "system", 
                    content: `Você é um gestor financeiro. Extraia dados de gastos ou receitas.
                    CATEGORIAS GASTO: [Contas de casa, Transportes, Mercado, Lazer, Saúde, Pet, Carro, Diversão, Pessoais]
                    CATEGORIAS RECEITA: [Salário, Renda Extra, Investimentos]
                    FORMAS: [Dinheiro, PIX, Crédito, Débito, Alimentação, Depósito, Boleto]
                    
                    REGRAS:
                    1. Entrada de dinheiro = 'Recebimento'. Saída = 'Gasto'.
                    2. Se for 'Crédito', identifique o Cartão (ex: Nubank).
                    3. Se houver valor, responda EXATAMENTE: [SALVAR] Tipo: X | Categoria: Y | Valor: Z | Observação: W | Forma: V | Cartão: K
                    4. Se não houver valor, apenas converse amigavelmente.` 
                },
                ...chatContext
            ]
        }, { headers: { "Authorization": `Bearer ${OPENAI_API_KEY.trim()}` } });

        const aiReply = response.data.choices[0].message.content;

        // Verifica se é um comando de salvar
        if (aiReply.includes("[SALVAR]")) {
            const extrair = (campo) => aiReply.match(new RegExp(`${campo}: (.*?) (?:\\||$)`))?.[1];
            
            const dados = {
                tipo: extrair("Tipo"),
                categoria: extrair("Categoria"),
                valor: extrair("Valor"),
                observacao: extrair("Observação"),
                forma: extrair("Forma"),
                cartao: extrair("Cartão"),
                data: new Date().toLocaleDateString('pt-BR')
            };

            const sucesso = await salvarNaPlanilha(dados);
            var finalReply = sucesso 
                ? `✅ *Registrado no seu ${meses[new Date().getMonth()]}!*\n💰 R$ ${dados.valor} em ${dados.categoria}\n📝 ${dados.observacao}`
                : `⚠️ Entendi o gasto, mas houve um erro ao acessar sua planilha.`;
        } else {
            var finalReply = aiReply;
        }

        // Salva resposta e envia via Z-API
        await Message.create({ phone, role: "assistant", content: finalReply });
        await axios.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE.trim()}/token/${ZAPI_TOKEN.trim()}/send-text`, 
            { phone, message: finalReply },
            { headers: { "client-token": MEU_CLIENT_TOKEN } }
        );

    } catch (error) {
        console.error("Erro:", error.message);
    }
    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor Online com Planilha e Memória!"));
