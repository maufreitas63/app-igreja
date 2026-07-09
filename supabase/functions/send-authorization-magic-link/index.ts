import nodemailer from 'npm:nodemailer@6.9.16';

type AuthorizationEmailPayload = {
  secret?: string;
  to?: string;
  confirmUrl?: string;
  fullName?: string;
  smtp_user?: string;
  smtp_password?: string;
  from?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function buildEmailText(fullName: string, confirmUrl: string) {
  return [
    `Olá, ${fullName}.`,
    '',
    'Recebemos sua solicitação de autorização de uso de imagem e voz.',
    '',
    'Para concluir com validade jurídica (Lei 14.063/2020 e LGPD), abra o link abaixo:',
    '',
    confirmUrl,
    '',
    'Se você não solicitou esta autorização, ignore este e-mail.',
  ].join('\n');
}

async function sendWithResend(to: string, from: string, subject: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY or from address not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error ${response.status}: ${body}`);
  }
}

async function sendWithGmail(payload: AuthorizationEmailPayload, to: string, subject: string, text: string) {
  const smtpUser = payload.smtp_user?.trim() ?? Deno.env.get('RECOVERY_EMAIL_SMTP_USER')?.trim();
  const smtpPassword =
    payload.smtp_password?.trim() ?? Deno.env.get('RECOVERY_EMAIL_SMTP_PASSWORD')?.trim();
  const from = payload.from?.trim() ?? Deno.env.get('RECOVERY_EMAIL_FROM')?.trim();

  if (!smtpUser || !smtpPassword || !from) {
    throw new Error('Gmail SMTP credentials not configured');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
  }

  try {
    const expectedSecret =
      Deno.env.get('MEDIA_AUTHORIZATION_EMAIL_SECRET')?.trim()
      ?? Deno.env.get('RECOVERY_EMAIL_FUNCTION_SECRET')?.trim()
      ?? '';

    const body = (await request.json()) as AuthorizationEmailPayload;
    const providedSecret = String(body.secret ?? '').trim();

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return jsonResponse({ ok: false, message: 'Unauthorized' }, 401);
    }

    const to = String(body.to ?? '').trim().toLowerCase();
    const confirmUrl = String(body.confirmUrl ?? '').trim();
    const fullName = String(body.fullName ?? 'Participante').trim();

    if (!to || !confirmUrl) {
      return jsonResponse({ ok: false, message: 'to and confirmUrl are required' }, 400);
    }

    const subject = 'Confirme sua autorização de imagem e voz';
    const text = buildEmailText(fullName, confirmUrl);
    const from =
      body.from?.trim()
      ?? Deno.env.get('MEDIA_AUTHORIZATION_EMAIL_FROM')?.trim()
      ?? Deno.env.get('RECOVERY_EMAIL_FROM')?.trim()
      ?? '';

    const hasGmail =
      Boolean(body.smtp_user?.trim() && body.smtp_password?.trim() && from)
      || Boolean(
        Deno.env.get('RECOVERY_EMAIL_SMTP_USER')?.trim()
          && Deno.env.get('RECOVERY_EMAIL_SMTP_PASSWORD')?.trim()
          && from
      );

    if (hasGmail) {
      await sendWithGmail(body, to, subject, text);
      return jsonResponse({ ok: true, provider: 'gmail' });
    }

    if (Deno.env.get('RESEND_API_KEY') && from) {
      await sendWithResend(to, from, subject, text);
      return jsonResponse({ ok: true, provider: 'resend' });
    }

    return jsonResponse(
      {
        ok: false,
        message:
          'Nenhum provedor de e-mail configurado. Use Gmail (recovery_email_*) ou RESEND_API_KEY.',
      },
      500
    );
  } catch (error) {
    console.error('[send-authorization-magic-link] failed', error);
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return jsonResponse({ ok: false, message }, 500);
  }
});
