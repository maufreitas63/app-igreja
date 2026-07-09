const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EmailPayload = {
  to?: string;
  confirmUrl?: string;
  fullName?: string;
  secret?: string;
};

async function sendWithResend(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MEDIA_AUTHORIZATION_EMAIL_FROM') ?? Deno.env.get('RECOVERY_EMAIL_FROM');

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY or MEDIA_AUTHORIZATION_EMAIL_FROM not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error ${response.status}: ${text}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get('MEDIA_AUTHORIZATION_EMAIL_SECRET') ?? '';
    const body = (await request.json()) as EmailPayload;
    const providedSecret = String(body.secret ?? '');

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const to = String(body.to ?? '').trim().toLowerCase();
    const confirmUrl = String(body.confirmUrl ?? '').trim();
    const fullName = String(body.fullName ?? 'Participante').trim();

    if (!to || !confirmUrl) {
      return new Response(JSON.stringify({ ok: false, message: 'to and confirmUrl are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subject = 'Confirme sua autorização de imagem e voz';
    const html = `
      <p>Olá, ${fullName}.</p>
      <p>Recebemos sua solicitação de autorização de uso de imagem e voz.</p>
      <p>Para concluir com validade jurídica (Lei 14.063/2020 e LGPD), confirme pelo link abaixo:</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>Se você não solicitou esta autorização, ignore este e-mail.</p>
    `;

    await sendWithResend(to, subject, html);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-authorization-magic-link] failed', error);
    return new Response(JSON.stringify({ ok: false, message: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
