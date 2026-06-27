import nodemailer from 'npm:nodemailer@6.9.16';

type RecoveryEmailPayload = {
  secret?: string;
  smtp_user?: string;
  smtp_password?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('RECOVERY_EMAIL_FUNCTION_SECRET')?.trim();

  if (!expectedSecret) {
    return jsonResponse(
      { ok: false, message: 'RECOVERY_EMAIL_FUNCTION_SECRET não configurado na Edge Function.' },
      500
    );
  }

  let payload: RecoveryEmailPayload;

  try {
    payload = (await req.json()) as RecoveryEmailPayload;
  } catch {
    return jsonResponse({ ok: false, message: 'JSON inválido.' }, 400);
  }

  if (payload.secret?.trim() !== expectedSecret) {
    return jsonResponse({ ok: false, message: 'Não autorizado.' }, 401);
  }

  const smtpUser = payload.smtp_user?.trim();
  const smtpPassword = payload.smtp_password?.trim();
  const from = payload.from?.trim();
  const to = payload.to?.trim();
  const subject = payload.subject?.trim() || 'Sua nova senha de acesso';
  const text = payload.text?.trim();

  if (!smtpUser || !smtpPassword || !from || !to || !text) {
    return jsonResponse(
      { ok: false, message: 'Campos obrigatórios: smtp_user, smtp_password, from, to, text.' },
      400
    );
  }

  try {
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

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar e-mail via Gmail.';

    return jsonResponse({ ok: false, message }, 502);
  }
});
