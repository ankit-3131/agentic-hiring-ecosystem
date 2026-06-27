export type ChatMessage = {
  id: string;
  application_id?: string;
  from_id?: string;
  from_name?: string;
  to_id?: string;
  content: string;
  msg_type?: string;
  type?: string;
  timestamp: string;
  read?: boolean;
  job_title?: string;
};

export function messageType(m: ChatMessage): string {
  return m.msg_type || m.type || 'message';
}
