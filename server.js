require('dotenv').config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// Configurações das Variáveis de Ambiente
const { OPENAI_API_KEY, ZAPI_TOKEN, ZAPI_INSTANCE, MONGODB_URI } = process.env;
const MEU_CLIENT_TOKEN = "COLE_AQUI_SEU_CLIENT_TOKEN_DA_ZAPI"; // Lembre de manter seu Client Token aqui!

// Conexão com o Banco de Dados (MongoDB)
mongoose.connect(MONGODB_URI)
  .then(() => console.log("Conectado ao MongoDB com sucesso! 🧠"))
  .catch(err => console.error("Erro ao conectar no MongoDB:", err));

// Esquema de Memória (O que vamos salvar)
const MessageSchema = new mongoose.Schema({
    phone: String,
    role: String, // 'user' ou 'assistant'
    content: String,
    createdAt: { type: Date, default: Date.now, expires: 86400 } // Memória apaga após 24h para não pesar
});
const Message = mongoose.model("Message", MessageSchema);

app.post("/webhook", async (req, res) => {
    const { isGroup, text, phone } = req.body;
    const userMessage = text?.message;

    if (isGroup === true || !userMessage || !phone) return res.sendStatus(200);

    try {
        console.log(`Mensagem de ${phone}: ${userMessage}`);

        // 1. Salva a mensagem atual do usuário no banco
        await Message.create({ phone, role: "user", content: userMessage });

        // 2. Busca as últimas 6 mensagens dessa conversa para dar contexto
        const history = await Message.find({ phone }).sort({ createdAt: -1 }).limit(6);
        const chatContext = history.reverse().map(m => ({ role: m.role, content: m.content }));

        // 3. Chamada para OpenAI com MEMÓRIA
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Você é um assistente financeiro pessoal. Se o usuário mandar um valor sem contexto, use as mensagens anteriores para entender do que se trata." },
                ...chatContext
            ]
        }, {
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY.trim()}` }
        });

        const aiReply = response.data.choices[0].message.content;

        // 4. Salva a resposta da IA no banco para ela se lembrar depois
        await Message.create({ phone, role: "assistant", content: aiReply });

        // 5. Envio para Z-API
        await axios.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE.trim()}/token/${ZAPI_TOKEN.trim()}/send-text`, 
            { phone: phone, message: aiReply },
            { headers: { "client-token": MEU_CLIENT_TOKEN.trim() } }
        );

        console.log("Resposta com memória enviada!");

    } catch (error) {
        console.error("Erro no processamento:", error.response?.data || error.message);
    }
    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor rodando!"));
