import { useState } from 'react';
import { useAuth } from '@/state/authStore';
import { useApp } from '@/state/appStore';
import { notify } from '@/state/toastStore';
import { L, useT } from '@/i18n';
import { Icon } from '../Icon';
import { Button } from '../kit';

/**
 * Settings → Account and data.
 *
 * Deleting an account used to live in a drawer inside the sync dialog, one
 * stray tap from "sign out". It is now a room of its own, which is both easier
 * to find on purpose and harder to reach by accident — the two things this
 * particular button needs to be at the same time.
 *
 * It is not hidden, and it does not ask anybody to write in for help. A person
 * who wants to leave should be able to leave from inside the product.
 */
export function DangerSection({ onClose }: { onClose: () => void }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const typed = ['ИЗТРИЙ', 'DELETE'].includes(confirmText.trim().toUpperCase());

  return (
    <div className="space-y-7">
      <section>
        <h3 className="t-label mb-2">{t(L('Изнеси данните си', 'Take your data with you'))}</h3>
        <p className="mb-3 text-[13px] leading-relaxed text-muted">
          {t(
            L(
              'Цялата библиотека — учебници, дъски, бележки, карти, задачи и история — излиза в един файл. Направи го преди всичко останало на тази страница.',
              'The whole library — textbooks, boards, notes, cards, tasks and history — comes out as a single file. Do this before anything else on this page.',
            ),
          )}
        </p>
        <Button icon="archive" onClick={() => useApp.getState().setSettings(true, 'data')}>
          {t(L('Към резервното копие', 'Go to Backup'))}
        </Button>
      </section>

      {!user ? (
        <section>
          <h3 className="t-label mb-2">{t(L('Данните на това устройство', 'The data on this device'))}</h3>
          <p className="text-[13px] leading-relaxed text-muted">
            {t(
              L(
                'Нямаш профил, така че няма какво да се изтрива от сървър. Всичко е в браузъра ти и си отива с изчистването на данните за сайта — но първо си направи копие, защото това е необратимо.',
                'You have no account, so there is nothing on a server to delete. Everything is in your browser and goes when you clear the site data — but take a backup first, because that cannot be undone.',
              ),
            )}
          </p>
        </section>
      ) : (
        <section>
          <h3 className="t-label mb-2" style={{ color: 'var(--c-danger)' }}>
            {t(L('Изтриване на профила', 'Delete the account'))}
          </h3>
          <div
            className="rounded-[var(--radius-lg)] p-4"
            style={{
              background: 'var(--c-danger-soft)',
              border: '1px solid color-mix(in srgb, var(--c-danger) 32%, transparent)',
            }}
          >
            <p className="text-[13px] leading-relaxed">
              {t(
                L(
                  'Профилът, всички качени файлове и всичко в облака изчезват веднага и безвъзвратно. Данните на това устройство остават непокътнати.',
                  'The account, every uploaded file and everything in the cloud disappear immediately and for good. The data on this device is left untouched.',
                ),
              )}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{user.email}</p>

            <p className="mt-4 text-[12.5px] font-medium">
              {t(L('Напиши ИЗТРИЙ, за да потвърдиш.', 'Type DELETE to confirm.'))}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t(L('ИЗТРИЙ', 'DELETE'))}
                className="field max-w-[200px]"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="btn btn-danger shrink-0"
                disabled={!typed || busy}
                onClick={() => {
                  setBusy(true);
                  void useAuth
                    .getState()
                    .removeAccount()
                    .then((err) => {
                      setBusy(false);
                      if (err) notify.error(t(L('Профилът не беше изтрит', 'The account was not deleted')), err);
                      else onClose();
                    });
                }}
              >
                {busy && <Icon name="refresh" size={14} className="animate-spin" />}
                {t(L('Изтрий профила', 'Delete the account'))}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
