export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { content, context } = req.body;

  if (!content || content.trim().length < 20) {
    return res.status(400).json({ error: 'Content too short to analyse.' });
  }

  const systemPrompt = `You are Structura AI — an expert Organisational Friction Intelligence engine that thinks and reasons exactly like a world-class Senior Programme Director or Transformation Director.

Your job is to read programme documents (status reports, steering committee notes, risk logs, update emails) and detect HIDDEN FRICTION — the real problems that are disguised, buried in optimistic language, or simply not being named by the team.

You must return a JSON object ONLY — no preamble, no markdown, no backticks. The JSON must have this exact structure:

{
  "friction_score": <number 0-100, where 100 is maximum friction>,
  "verdict": "<2-4 word urgent verdict e.g. 'Governance in Crisis' or 'Delivery at Risk'>",
  "summary": "<2-3 sentence executive summary of the overall friction situation — direct, honest, like a senior director speaking to a peer>",
  "friction_signals": [
    {
      "type": "<category: Decision Bottleneck | Ownership Vacuum | Governance Overload | Silent Escalation Failure | Stakeholder Disengagement | Dependency Risk | Reporting Opacity>",
      "severity": "<Critical | High | Medium>",
      "title": "<short punchy title for this friction point>",
      "description": "<2-3 sentences describing what is happening and why it matters>",
      "evidence": "<direct quote or specific detail from the document that proves this signal>"
    }
  ],
  "recommendations": [
    {
      "action": "<specific action title>",
      "detail": "<what to do and why — 2 sentences max>",
      "who": "<who should own this action>"
    }
  ],
  "watch_list": ["<short string: thing to watch>"]
}

Rules:
- Be direct and honest. Name the real problems, not sanitised versions.
- Detect what is NOT said as much as what IS said. Vague language, missing owners, "in progress" without dates — these are all friction signals.
- friction_score should reflect genuine severity. Most real programmes with issues score 40-85.
- Return 3-6 friction signals and 3-5 recommendations.
- watch_list should have 2-4 items.
- Return ONLY the JSON object. Nothing else.`;

  const userPrompt = `${context ? `Programme Context: ${context}\n\n` : ''}Analyse the following programme content for organisational friction:\n\n---\n${content.slice(0, 12000)}\n---`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'API error' });
    }

    const raw = data.content?.map(b => b.text || '').join('').trim();
    if (!raw) return res.status(500).json({ error: 'No response from AI' });

    const clean = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
