require('dotenv').config();
const axios = require('axios');

const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
const models = [
  'google/flan-t5-small',
  'sshleifer/distilbart-cnn-12-6',
  'facebook/bart-large-cnn',
  'gpt2'
];

async function test() {
  if (!HUGGINGFACE_TOKEN) {
    console.error('No HUGGINGFACE_TOKEN set');
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${HUGGINGFACE_TOKEN}`, 'Content-Type': 'application/json' };
  const prompt = 'Resume esto en una frase: prueba de conexión';
  for (const m of models) {
    const url = `https://api-inference.huggingface.co/models/${m}`;
    try {
      console.log('\n--- Trying model:', m, '---');
      const res = await axios.post(url, { inputs: prompt }, { headers, timeout: 20000 });
      console.log('Status:', res.status);
      console.log('Data:', typeof res.data === 'string' ? res.data : JSON.stringify(res.data).slice(0,200));
      return;
    } catch (err) {
      const status = err?.response?.status || 'NO_STATUS';
      const body = err?.response?.data || err.message;
      console.error('Model failed:', m, 'status=', status, 'body=', typeof body === 'string' ? body : JSON.stringify(body).slice(0,200));
    }
  }
  console.error('All models failed');
}

test();
