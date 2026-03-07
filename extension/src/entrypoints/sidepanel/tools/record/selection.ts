type TimelineEntryWithId = {
  id: string;
};

export const getRecordTimelineEntryIds = (entries: TimelineEntryWithId[]) => entries.map((entry) => entry.id);

export const hasFullRecordSelection = (entries: TimelineEntryWithId[], selectedEntryIds: string[]) => {
  if (entries.length === 0) {
    return false;
  }

  const selectedEntryIdSet = new Set(selectedEntryIds);
  return entries.every((entry) => selectedEntryIdSet.has(entry.id));
};
