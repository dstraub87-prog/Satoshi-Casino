import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TELEGRAM_CHANNEL = '@SatsArcadeHubNews'
const MINI_APP_LINK = 'https://t.me/SatsArcadeHubBot/SatsArcadeHub'
const SITE_LINK = 'https://satsarcadehub.com'

// Rotating content themes - cycles through so posts stay fresh
const THEMES = [
  {
    type: 'streak_reminder',
    prompt: `Write a short, punchy Telegram post reminding players to claim their daily streak in Sats Arcade Hub. 
    Mention that streaks give free Bitcoin sats. Use 2-3 emojis. Max 3 sentences. 
    End with a call to action to play. Do not use hashtags. Keep it casual and exciting.`
  },
  {
    type: 'game_tip',
    prompt: `Write a quick game tip post for Sats Arcade Hub players. 
    Pick ONE of these games randomly and give a genuine tip: Plinko (buy more balls, higher multi = more risk/reward), 
    Blackjack (basic strategy: always hit on soft 17), Slots (hold matching symbols), 
    Coin Flip (50/50 but 1.8x payout), Mines (cash out early for consistent wins).
    Use 2-3 emojis. Max 3 sentences. Casual tone. No hashtags.`
  },
  {
    type: 'engagement',
    prompt: `Write an engaging question post for Sats Arcade Hub's Telegram channel.
    Ask players something fun like: their favorite game, biggest win, how long their streak is, 
    or what game they want added next. Use 2-3 emojis. Keep it short and conversational.
    No hashtags. End with something that invites replies.`
  },
  {
    type: 'invite_friends',
    prompt: `Write a promotional post encouraging Sats Arcade Hub players to invite friends.
    Mention the referral bonus (10,000 free coins per referral). Keep it exciting but not spammy.
    Use 2-3 emojis. Max 3 sentences. Casual tone. No hashtags.`
  },
  {
    type: 'streak_reminder',
    prompt: `Write a different daily streak reminder for Sats Arcade Hub. 
    This time focus on streak STREAKS - like what happens at day 7 (fire emoji bonus).
    Mention free Bitcoin sats. Use 2-3 emojis. Max 3 sentences. No hashtags.`
  },
  {
    type: 'game_tip',
    prompt: `Write a Plinko-specific tip for Sats Arcade Hub. 
    Tip: buying more balls with coins and using the multiplier gives better expected value.
    Mention the jackpot buckets. Use 2-3 emojis. Max 3 sentences. Casual and exciting. No hashtags.`
  },
  {
    type: 'engagement',
    prompt: `Write a fun poll-style post for Sats Arcade Hub Telegram channel.
    Give players two options to vote on in the replies, like: 
    "Plinko 🎱 or Slots 🎰?" or "Big win and cashout OR keep playing for jackpot?"
    Use emojis. Short and fun. No hashtags.`
  },
  {
    type: 'invite_friends',
    prompt: `Write a FOMO-style post for Sats Arcade Hub about playing with friends.
    Angle: more friends = bigger community = bigger sat prize pool.
    Use 2-3 emojis. Max 3 sentences. No hashtags. End with referral angle.`
  },
]

// Track which theme to use via a simple daily counter
function getThemeIndex(): number {
  const now = new Date()
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const hour = now.getUTCHours()
  // Morning post = even index, evening post = odd index
  const slot = hour < 14 ? 0 : 1
  return (dayOfYear * 2 + slot) % THEMES.length
}

async function generatePost(theme: typeof THEMES[0]): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: theme.prompt }],
    }),
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  return text.trim()
}

async function postToTelegram(text: string): Promise<void> {
  // Append the play link to every post
  const fullMessage = `${text}\n\n▶️ Play free: ${MINI_APP_LINK}`

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL,
        text: fullMessage,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: false },
      }),
    }
  )

  const result = await response.json()
  if (!result.ok) {
    throw new Error(`Telegram error: ${JSON.stringify(result)}`)
  }
}

serve(async (req) => {
  try {
    // Allow manual trigger with optional theme override
    let themeIndex = getThemeIndex()
    
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        if (typeof body.theme_index === 'number') {
          themeIndex = body.theme_index % THEMES.length
        }
      } catch (_) { /* ignore parse errors */ }
    }

    const theme = THEMES[themeIndex]
    console.log(`[Bot] Generating post for theme: ${theme.type} (index ${themeIndex})`)

    const postText = await generatePost(theme)
    console.log(`[Bot] Generated: ${postText.slice(0, 80)}...`)

    await postToTelegram(postText)
    console.log(`[Bot] Posted to ${TELEGRAM_CHANNEL}`)

    return new Response(
      JSON.stringify({ success: true, theme: theme.type, preview: postText.slice(0, 100) }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[Bot] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
