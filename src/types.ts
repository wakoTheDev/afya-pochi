export interface Message {
  id: string;
  role: "user" | "model" | "tool";
  text: string;
  timestamp: string;
  actionType?: "database_lookup" | "map_grounding" | "general_conversation";
  toolResult?: any;
  functionCalled?: string;
  functionArgs?: any;
  isAudio?: boolean;
}

export interface UserData {
  name: string;
  history: string;
  meds: string;
  location: string;
}

export interface VoiceSettings {
  autoSpeak: boolean;
  rate: number;
  pitch: number;
}
