require('dotenv').config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Pegamos apenas a da OpenAI das variáveis (que já sabemos que está funcionando)
const { OPENAI_API_KEY } = process.env;

// COLOQUE SEUS DADOS DA Z-API AQUI ENTRE AS ASPAS (PEGUE DAQUELA FOTO)
const MEU_ID_INSTANCIA = "3F068B87720A321E31F9763ED8CCDC79"; 
const MEU_TOKEN_INSTANCIA = "56E66A90324CF5A8A192AC7F";

app.post("/webhook", async (req, res) => {
    const isGroup = req.body.isGroup;
    const message = req.body.text?.message;
    const phone = req.body.phone;

    if (isGroup === true || !message || !phone) return res.sendStatus(200);

    try {
        console.log("IA processando...");
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }]
        }, {
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY.trim()}` }
        });

        const aiReply = response.data.choices[0].message.content;

        // TESTE DE ENVIO DIRETO
        await axios.post(`https://api.z-api.io/instances/${MEU_ID_INSTANCIA}/token/${MEU_TOKEN_INSTANCIA}/send-text`, {
            phone: phone,
            message: aiReply
        });

        console.log("FINALMENTE! Sucesso total.");

    } catch (error) {
        console.error("Erro detalhado:", error.response?.data || error.message);
    }
    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000);
