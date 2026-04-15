export type RecordTimelineEntry = {
  id: string;
  action: string;
  detail: string;
  timestamp: number;
};

export type RecordPanelState = {
  isRecording: boolean;
  timeline: RecordTimelineEntry[];
  updatedAt: number;
};

export const buildDefaultRecordPanelState = (): RecordPanelState => ({
  isRecording: true,
  timeline: [],
  updatedAt: Date.now(),
});
