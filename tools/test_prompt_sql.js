const OLLAMA_BASE_URL = 'http://localhost:11434';

async function testPrompt() {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5:9b',
      messages: [
        { role: 'system', content: 'Sen PostgreSQL için Text-to-SQL asistanısın. Sadece geçerli bir JSON üret: {"sql": "SELECT ...", "intent_summary": "..."}' },
        { role: 'user', content: 'Bugün kimler geç kaldı? (Filtre: day = \'2026-01-02\')' }
      ],
      stream: false,
      format: 'json',
      options: {
        temperature: 0.0
      }
    })
  });
  const data = await res.json();
  console.log('DATA CHAT MESSAGE:\n', data.message);
}

testPrompt();
