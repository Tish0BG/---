import { useWorkspace } from '@/state/workspaceStore';
import { Avatar } from '../kit';

/**
 * The signed-in person's own face, bound to the profile once so that every
 * place that draws it agrees.
 *
 * There were four of these before — the rail, the header menu, the profile
 * page and the settings dialog — each reaching into the store and each
 * falling back differently, which is how the same account ended up as an owl
 * in one corner and a blank circle in another.
 *
 * One rule about colour, which is worth stating because it is not obvious:
 * the picked profile colour tints an emoji avatar, and a letter avatar takes
 * its colour from the handle instead. The profile colour has a default that
 * nobody chose, so honouring it on the letter would paint every account in
 * the product the same blue — which is precisely the thing the derived colour
 * exists to avoid.
 */
export function ProfileAvatar({
  size = 32,
  ring,
  className,
}: {
  size?: number;
  /** level progress, 0–1; omit for a plain avatar */
  ring?: number;
  className?: string;
}) {
  const profile = useWorkspace((s) => s.profile);
  const hasEmoji = !profile.photo && !!profile.avatar;

  return (
    <Avatar
      photo={profile.photo || undefined}
      emoji={hasEmoji ? profile.avatar : undefined}
      name={profile.name}
      seed={profile.username || profile.name}
      color={hasEmoji ? profile.color : undefined}
      size={size}
      ring={ring}
      className={className}
    />
  );
}
