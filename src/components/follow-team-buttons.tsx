import { toggleFollowAction } from "@/app/following/actions";

export function FollowTeamButtons({
  homeId,
  awayId,
  homeName,
  awayName,
  followedTeamIds,
}: {
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  followedTeamIds: string[];
}) {
  const followed = new Set(followedTeamIds);
  const teams = [
    { id: homeId, name: homeName },
    { id: awayId, name: awayName },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((team) => {
        const active = followed.has(team.id);
        return (
          <form key={team.id} action={toggleFollowAction}>
            <input type="hidden" name="teamId" value={team.id} />
            <button
              type="submit"
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                active
                  ? "bg-[var(--pitch)] text-[var(--pitch-ink)]"
                  : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--accent)]"
              }`}
            >
              {active ? `Following ${team.name}` : `Follow ${team.name}`}
            </button>
          </form>
        );
      })}
    </div>
  );
}
