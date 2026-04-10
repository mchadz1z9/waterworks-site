export async function onRequestPost(context) {
  try {
    const { message, history, bookings } = await context.request.json();

    // Build business stats from bookings
    let earned = 0, unpaidAmt = 0, paid = 0, unpaid = 0, flagged = 0;
    const serviceCounts = {};
    bookings.forEach(function(b) {
      if (b.status === 'paid')   { paid++;   earned    += b.amount; }
      if (b.status === 'unpaid') { unpaid++; unpaidAmt += b.amount; }
      if (b.flagged) flagged++;
      if (b.service) serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1;
    });
    const topService = Object.entries(serviceCounts).sort((a,b) => b[1]-a[1])[0];

    const systemPrompt = `You are an Assistant, an expert marketing and business growth specialist working exclusively for WaterWorks & Lawn Care — a local home services company run by a young entrepreneur. You live inside their booking tracker and have full access to their real business data.

YOUR ROLE:
- Marketing strategist: create campaigns, promotions, upsell ideas
- Business analyst: spot trends, flag issues, forecast revenue
- Customer expert: identify best/worst customers, retention strategies
- Pricing advisor: recommend rates, bundles, seasonal pricing
- Content creator: draft texts, flyers, social posts, follow-up messages

LIVE BUSINESS DATA:
- Total bookings: ${bookings.length}
- Revenue collected: $${earned.toFixed(2)}
- Outstanding unpaid: $${unpaidAmt.toFixed(2)} across ${unpaid} jobs
- Flagged customers: ${flagged}
- Most popular service: ${topService ? topService[0] + ' (' + topService[1] + ' jobs)' : 'N/A'}
- Services: Lawn Mowing, Pressure Washing, Car Wash, Snow Removal

RECENT BOOKINGS (latest 15):
${JSON.stringify(bookings.slice(0, 15).map(function(b) {
  return { name: b.name, service: b.service, amount: b.amount, status: b.status, date: b.date, flagged: b.flagged || false };
}), null, 2)}

RULES:
- Be direct, practical, and conversational — like a real advisor texting them
- Keep responses under 180 words unless they ask for something longer
- Use bullet points for lists, bold key numbers
- Always tie advice back to their actual data when possible
- Never ask for an API key or mention any technical setup`;

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      { role: 'user', content: message }
    ];

    const result = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: allMessages,
      max_tokens: 600,
      temperature: 0.75
    });

    return Response.json({ reply: result.response });

  } catch (err) {
    return Response.json({ error: 'Max is unavailable right now. Try again in a moment.' }, { status: 500 });
  }
}
