export interface TodoSummary {
  summary: string;
  urgentTasks: string[];
  insights: string[];
  recommendations: string[];
}

export interface SummaryRequest {
  todos: Array<{
    id: string;
    title: string;
    description: string;
    due_date: string | null;
    priority: "high" | "medium" | "low";
    category: string;
    completed: boolean;
    created_date?: string;
  }>;
  period: "today" | "week";
}

