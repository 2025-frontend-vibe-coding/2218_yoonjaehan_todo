export type Priority = "high" | "medium" | "low";
export type RepeatType = "none" | "hourly" | "daily" | "weekly" | "monthly";
export type TodoStatus = "진행 중" | "완료" | "지연";

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description: string;
  created_date: string;
  due_date: string | null;
  priority: Priority;
  category: string;
  completed: boolean;
  updated_at: string;
  position?: number;
  repeat_type?: RepeatType;
  repeat_interval?: number;
  repeat_days_of_week?: number[]; // 0=일요일, 1=월요일, ..., 6=토요일
  repeat_end_date?: string | null;
  parent_todo_id?: string | null;
}

export interface TodoFormData {
  title: string;
  description: string;
  due_date: string | null;
  priority: Priority;
  category: string;
  completed: boolean;
  repeat_type?: RepeatType;
  repeat_interval?: number;
  repeat_days_of_week?: number[];
  repeat_end_date?: string | null;
}

