import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TERMS_TEXT =
  'Autorização para uso de imagem e voz: Declaro estar ciente de que os cultos, celebrações, eventos e demais atividades promovidas pela igreja poderão ser fotografados, filmados e transmitidos pelos seus canais oficiais. Na qualidade de participante e de responsável legal pelos menores de idade vinculados ao meu cadastro familiar, autorizo a captação e a utilização da minha imagem e voz, bem como da imagem e voz desses menores, para fins institucionais, educativos, históricos e de divulgação das atividades da igreja, em mídias impressas, digitais, redes sociais, transmissões ao vivo e demais canais oficiais, sem qualquer ônus, observadas a legislação aplicável, especialmente a Lei nº 13.709/2018 (LGPD), e o respeito à honra, à dignidade e à privacidade dos envolvidos.';

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('MEDIA_AUTHORIZATION_PDF_SECRET') ?? '';
    const body = await request.json();
    const authorizationId = String(body.authorizationId ?? '');
    const providedSecret = String(body.secret ?? '');

    if (!secret || providedSecret !== secret) {
      return new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!authorizationId) {
      return new Response(JSON.stringify({ ok: false, message: 'authorizationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: authorization, error } = await supabase
      .from('authorizations')
      .select('*')
      .eq('id', authorizationId)
      .maybeSingle();

    if (error || !authorization) {
      console.error('[generate-authorization-pdf] authorization not found', error);
      return new Response(JSON.stringify({ ok: false, message: 'Authorization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const acceptedAt = new Date(authorization.accepted_at ?? Date.now());
    const acceptedLabel = acceptedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const termsHash = authorization.accepted_text_hash ?? (await sha256Hex(TERMS_TEXT));
    const ipAddress = authorization.ip_address ?? 'não informado';

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let cursorY = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Autorização de Uso de Imagem e Voz', 105, cursorY, { align: 'center' });
    cursorY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    cursorY = wrapText(doc, TERMS_TEXT, 15, cursorY, 180, 6);
    cursorY += 8;

    const signatureLine = `Assinado eletronicamente por: ${authorization.full_name}, CPF: ${formatCpf(
      authorization.cpf
    )}, Telefone: ${authorization.phone}, em ${acceptedLabel}.`;

    cursorY = wrapText(doc, signatureLine, 15, cursorY, 180, 6);
    cursorY += 10;

    const footer =
      `Este documento possui validade jurídica conforme a Lei nº 14.063/2020 e MP nº 2.200-2/2001. ` +
      `A integridade e autoria desta manifestação foram validadas pelo registro de IP ${ipAddress}, ` +
      `timestamp ${acceptedLabel} e confirmação via e-mail autenticado (Hash do Termo: ${termsHash}).`;

    wrapText(doc, footer, 15, cursorY, 180, 6);

    const pdfBytes = doc.output('arraybuffer');
    const storagePath = `authorizations/${authorizationId}/${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('authorizations')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('[generate-authorization-pdf] upload failed', uploadError);
      return new Response(JSON.stringify({ ok: false, message: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, storagePath }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-authorization-pdf] unexpected error', error);
    return new Response(JSON.stringify({ ok: false, message: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
