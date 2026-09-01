const { SYSTEM_PROMPT } = require('./chat_intent_router');

(async () => {
  const t0 = Date.now();
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5:9b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'Çalışma saatleri nedir?' }
      ],
      stream: false,
      format: 'json',
      options: {
        temperature: 0.0,
        think: false
      }
    })
  });
  const data = await response.json();
  const ms = Date.now() - t0;
  console.log(`Duration with think:false -> ${ms}ms`);
  console.log(data.message.content);
})();
