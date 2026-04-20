export interface MediaEvent {
  type: 'media';
  media_type: 'video' | 'image';
  filename: string;
}

export interface ClaimEvent {
  type: 'claim';
  text: string;
  status: 'checking';
}

export interface ResultEvent {
  type: 'result';
  text: string;
  verdict: 'TRUE' | 'FALSE' | 'UNVERIFIABLE';
  explanation: string;
  source: string;
}

export interface StatusEvent {
  type: 'status';
  message: string;
}

export interface TextEvent {
  type: 'text';
  content: string;
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  vision_required?: boolean;
}

export type SseEvent =
  | MediaEvent
  | ClaimEvent
  | ResultEvent
  | StatusEvent
  | TextEvent
  | DoneEvent
  | ErrorEvent;

export interface ClaimState {
  text: string;
  status: 'checking' | 'done';
  verdict?: 'TRUE' | 'FALSE' | 'UNVERIFIABLE';
  explanation?: string;
  source?: string;
}
