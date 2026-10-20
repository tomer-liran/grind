// @ts-check

export function getSupersetGroupIndices(session, slotIndex) {
  const slot = session?.slots?.[slotIndex];
  if (!slot?.supersetGroup) return null;

  return session.slots
    .map((candidate, index) =>
      candidate.supersetGroup === slot.supersetGroup ? index : -1,
    )
    .filter((index) => index !== -1);
}

function setsForSlot(session, slotIndex) {
  if (slotIndex === session.slotIndex) return session.currentSets ?? [];
  return session.partialSets?.[slotIndex] ?? [];
}

function hasIncompleteSets(session, slotIndex) {
  const expectedSets = session.pickedExercises?.[slotIndex]?.sets ?? 0;
  const sets = setsForSlot(session, slotIndex);
  if (sets.length < expectedSets) return true;
  return sets.some((set) => !set.done);
}

export function getNextSupersetTarget(session) {
  const groupIndices = getSupersetGroupIndices(session, session?.slotIndex);
  if (!groupIndices) return null;

  const remaining = groupIndices.filter((slotIndex) =>
    hasIncompleteSets(session, slotIndex),
  );
  if (remaining.length === 0) {
    return { type: "complete-all", slotIndices: groupIndices };
  }

  const currentPosition = groupIndices.indexOf(session.slotIndex);
  const nextIndex =
    groupIndices
      .slice(currentPosition + 1)
      .find((slotIndex) => remaining.includes(slotIndex)) ??
    groupIndices.find((slotIndex) => remaining.includes(slotIndex));

  return {
    type: "jump",
    slotIndex: nextIndex,
    needsRest: groupIndices.indexOf(nextIndex) <= currentPosition,
  };
}
