/**
 * Renders the transactional e-mails Supabase sends on Plauvia's behalf.
 *
 * They are generated rather than written four times for the same reason the
 * icons are: a shell copied by hand drifts, and the first anybody hears of it
 * is a password-reset mail still carrying last year's logo. One frame, four
 * letters, and `supabase/emails/` holds the output ready to paste into
 * Authentication → Emails.
 *
 * Two constraints shape the markup. Mail clients from 2011 are still in use,
 * so it is tables and inline styles, not flexbox. And the mark cannot be an
 * SVG — Gmail drops those — so it is the PNG already deployed on the site.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND } from '../src/brand.ts';
import { BRAND_BLUE, BRAND_BLUE_DEEP } from '../src/components/brand/mark.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'supabase/emails');

const INK = '#0e1116';
const MUTED = '#4d5568';
const FAINT = '#6d768c';
const LINE = '#dfe4ef';
const PAPER = '#f6f7fb';

/**
 * The frame. `body` is the sentence before the code, `code` is the token
 * placeholder Supabase substitutes, and `after` is the small print.
 */
const letter = ({ preheader, heading, body, after }) => `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${BRAND.name}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAPER};">
    <!-- The line shown in the inbox list, next to the subject. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:480px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;">
            <tr>
              <td style="padding:28px 28px 0 28px;">
                <img src="${BRAND.url}/icons/icon-192.png" width="36" height="36" alt="${BRAND.name}"
                     style="display:block;border:0;border-radius:10px;">
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0 28px;">
                <h1 style="margin:0;font:600 23px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
                           letter-spacing:-0.5px;color:${INK};">${heading}</h1>
                <p style="margin:12px 0 0 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
                          color:${MUTED};">${body}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="background:${PAPER};border:1px solid ${LINE};border-radius:12px;padding:20px 12px;">
                      <div style="font:600 34px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
                                  letter-spacing:9px;color:${INK};">{{ .Token }}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px 28px;">
                <p style="margin:0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
                          color:${FAINT};">${after}</p>
              </td>
            </tr>
          </table>

          <p style="margin:18px 0 0 0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
                    color:${FAINT};">
            ${BRAND.name} · <a href="${BRAND.url}" style="color:${BRAND_BLUE};text-decoration:none;">${BRAND.domain}</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

/** The one letter that is a link rather than a code: confirming a new address. */
const linkLetter = ({ preheader, heading, body, button, after }) =>
  letter({ preheader, heading, body, after })
    .replace(
      /<div style="font:600 34px[^"]*">\{\{ \.Token \}\}<\/div>/,
      `<a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:${BRAND_BLUE};background-image:linear-gradient(135deg,${BRAND_BLUE},${BRAND_BLUE_DEEP});
                color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 26px;
                font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${button}</a>`,
    )
    .replace(`background:${PAPER};border:1px solid ${LINE};border-radius:12px;padding:20px 12px;`, 'padding:4px 12px;');

const templates = {
  'confirm-signup.html': letter({
    preheader: 'Кодът за потвърждение на профила ти в Plauvia.',
    heading: 'Потвърди профила си',
    body: 'Въведи този код в Plauvia, за да активираш профила си. Валиден е за около час.',
    after:
      'Ако не си създавал профил, не прави нищо — без този код профилът не се активира и адресът ти остава свободен.',
  }),

  'magic-link.html': letter({
    preheader: 'Кодът ти за влизане в Plauvia.',
    heading: 'Кодът ти за влизане',
    body: 'Въведи го в Plauvia и си вътре. Валиден е за около час и работи само веднъж.',
    after:
      'Ако не си искал да влезеш, някой знае адреса ти, но не и паролата. Кодът е безполезен, докато не бъде въведен — не го препращай на никого.',
  }),

  'recovery.html': letter({
    preheader: 'Кодът за нова парола в Plauvia.',
    heading: 'Нова парола',
    body: 'Въведи този код в Plauvia и после избери новата си парола. Валиден е за около час.',
    after:
      'Ако не си искал нова парола, не прави нищо. Старата продължава да работи и никой не е влизал в профила ти.',
  }),

  'email-change.html': letter({
    preheader: 'Потвърди новия си адрес за Plauvia.',
    heading: 'Потвърди новия адрес',
    body: 'Въведи този код, за да свържеш този адрес с профила си в Plauvia.',
    after: 'Ако не си променял адреса си, пиши ни — някой има достъп до профила ти.',
  }),

  'reauthentication.html': letter({
    preheader: 'Код за потвърждение на самоличност в Plauvia.',
    heading: 'Потвърди, че си ти',
    body: 'Тази промяна иска потвърждение. Въведи кода, за да продължиш.',
    after: 'Ако не си поискал това, смени паролата си възможно най-скоро.',
  }),

  'invite.html': linkLetter({
    preheader: 'Покана за Plauvia.',
    heading: 'Покана за Plauvia',
    body: 'Някой те кани в Plauvia. Отвори връзката, за да си създадеш профил.',
    button: 'Приеми поканата',
    after: 'Ако не очакваш покана, просто не отваряй връзката.',
  }),
};

mkdirSync(out, { recursive: true });
for (const [name, html] of Object.entries(templates)) {
  writeFileSync(resolve(out, name), html);
}

console.log(`  Plauvia · ${Object.keys(templates).length} шаблона за писма в supabase/emails/`);
