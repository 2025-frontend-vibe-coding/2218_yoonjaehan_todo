"use client";

import { useState, useEffect } from "react";
import { Todo, Priority } from "@/types/todo";
import { Calendar, Tag, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodoCardProps {
  todo: Todo;
  onToggleComplete?: (id: string) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
}

const priorityColors: Record<Priority, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const priorityLabels: Record<Priority, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};

export default function TodoCard({
  todo,
  onToggleComplete,
  onEdit,
  onDelete,
}: TodoCardProps) {
  const [formattedDate, setFormattedDate] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (todo.due_date) {
      const date = new Date(todo.due_date);
      const formatted = date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setFormattedDate(formatted);
    }
  }, [todo.due_date]);

  const isOverdue =
    !todo.completed && todo.due_date && new Date(todo.due_date) < new Date();

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md",
        todo.completed && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation(); // 드래그 이벤트 전파 방지
            onToggleComplete?.(todo.id);
          }}
          className="mt-1 flex-shrink-0"
          aria-label={todo.completed ? "완료 취소" : "완료"}
        >
          {todo.completed ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "font-semibold text-lg",
                todo.completed && "line-through text-muted-foreground"
              )}
            >
              {todo.title}
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-xs font-medium",
                  priorityColors[todo.priority]
                )}
              >
                {priorityLabels[todo.priority]}
              </span>
            </div>
          </div>

          {todo.description && (
            <p
              className={cn(
                "text-sm text-muted-foreground",
                todo.completed && "line-through"
              )}
            >
              {todo.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {todo.due_date && (
              <div
                className={cn(
                  "flex items-center gap-1",
                  isOverdue && "text-red-600 dark:text-red-400 font-medium"
                )}
              >
                <Calendar className="h-3 w-3" />
                <span>
                  {isMounted ? formattedDate : todo.due_date.split("T")[0]}
                </span>
                {isOverdue && !todo.completed && (
                  <span className="ml-1">(지연)</span>
                )}
              </div>
            )}

            {todo.category && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                <span>{todo.category}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // 드래그 이벤트 전파 방지
                onEdit(todo);
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="편집"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // 드래그 이벤트 전파 방지
                onDelete(todo.id);
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              aria-label="삭제"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

