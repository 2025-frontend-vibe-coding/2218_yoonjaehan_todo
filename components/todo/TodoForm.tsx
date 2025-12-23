"use client";

import { useState, useEffect } from "react";
import { Todo, TodoFormData, Priority, RepeatType } from "@/types/todo";
import { Calendar, Sparkles, Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TodoFormProps {
  todo?: Todo | null;
  onSubmit: (data: TodoFormData) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  onAutoSave?: (todos: TodoFormData[]) => Promise<void>;
}

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "high", label: "높음" },
  { value: "medium", label: "중간" },
  { value: "low", label: "낮음" },
];

const defaultCategories = ["업무", "개인", "학습"];

export default function TodoForm({
  todo,
  onSubmit,
  onCancel,
  isLoading = false,
  onAutoSave,
}: TodoFormProps) {
  const [formData, setFormData] = useState<TodoFormData>({
    title: "",
    description: "",
    due_date: null,
    priority: "medium",
    category: "",
    completed: false,
    repeat_type: "none",
    repeat_interval: 1,
    repeat_days_of_week: [],
    repeat_end_date: null,
  });

  const [customCategory, setCustomCategory] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI 할 일 생성 함수
  const handleAiGenerate = async () => {
    if (!aiInput.trim()) {
      setAiError("자연어로 할 일을 입력해주세요.");
      return;
    }

    setIsAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch("/api/ai-todo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: aiInput.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "알 수 없는 오류가 발생했습니다." }));
        throw new Error(errorData.error || `서버 오류 (${response.status})`);
      }

      const data = await response.json();

      if (!data || !data.todos || !Array.isArray(data.todos) || data.todos.length === 0) {
        throw new Error("AI가 유효한 할 일을 생성하지 못했습니다. 다시 시도해주세요.");
      }

      // 여러 할 일이 생성된 경우 자동 저장
      if (data.todos.length > 1 && onAutoSave) {
        const todosToSave = data.todos.map((todo: any) => ({
          title: todo.title || "",
          description: todo.description || "",
          due_date: todo.due_date || null,
          priority: todo.priority || "medium",
          category: todo.category || "기타",
          completed: false,
        }));
        
        await onAutoSave(todosToSave);
        setAiInput("");
        setAiError(null);
        return;
      }

      // 모든 할 일 자동 저장
      if (onAutoSave) {
        const todosToSave = data.todos.map((todo: any) => ({
          title: todo.title || "",
          description: todo.description || "",
          due_date: todo.due_date || null,
          priority: todo.priority || "medium",
          category: todo.category || "기타",
          completed: false,
        }));
        
        await onAutoSave(todosToSave);
      } else {
        // onAutoSave가 없으면 폼에 채우기 (편집 모드일 때)
        const firstTodo = data.todos[0];
        setFormData({
          title: firstTodo.title || "",
          description: firstTodo.description || "",
          due_date: firstTodo.due_date
            ? new Date(firstTodo.due_date).toISOString().slice(0, 16)
            : null,
          priority: firstTodo.priority || "medium",
          category: firstTodo.category || "",
          completed: false,
        });
      }

      // AI 입력 필드 초기화
      setAiInput("");
      setAiError(null);
    } catch (error: any) {
      console.error("AI 할 일 생성 오류:", error);
      console.error("오류 상세:", {
        message: error.message,
        stack: error.stack,
      });
      const errorMessage = error.message || "AI 할 일 생성 중 오류가 발생했습니다.";
      setAiError(errorMessage);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (todo) {
      setFormData({
        title: todo.title,
        description: todo.description,
        due_date: todo.due_date
          ? new Date(todo.due_date).toISOString().slice(0, 16)
          : null,
        priority: todo.priority,
        category: todo.category,
        completed: todo.completed,
        repeat_type: todo.repeat_type || "none",
        repeat_interval: todo.repeat_interval || 1,
        repeat_days_of_week: todo.repeat_days_of_week || [],
        repeat_end_date: todo.repeat_end_date
          ? new Date(todo.repeat_end_date).toISOString().slice(0, 16)
          : null,
      });
    } else {
      // todo가 null이면 폼 초기화
      setFormData({
        title: "",
        description: "",
        due_date: null,
        priority: "medium",
        category: "",
        completed: false,
        repeat_type: "none",
        repeat_interval: 1,
        repeat_days_of_week: [],
        repeat_end_date: null,
      });
      setCustomCategory("");
    }
  }, [todo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      category: formData.category || customCategory,
      due_date: formData.due_date
        ? new Date(formData.due_date).toISOString()
        : null,
    };
    onSubmit(submitData);
  };

  const handleChange = (
    field: keyof TodoFormData,
    value: string | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* AI 기반 할 일 생성 */}
      {!todo && (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <label htmlFor="ai-input" className="text-sm font-medium">
              AI로 할 일 생성
            </label>
          </div>
          <div className="flex gap-2">
            <input
              id="ai-input"
              type="text"
              value={aiInput}
              onChange={(e) => {
                setAiInput(e.target.value);
                setAiError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isAiLoading) {
                  e.preventDefault();
                  handleAiGenerate();
                }
              }}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="예: 내일 오후 3시까지 중요한 팀 회의 준비하기"
              disabled={isLoading || isAiLoading}
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={isLoading || isAiLoading || !aiInput.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {isAiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "생성"
              )}
            </button>
          </div>
          {aiError && (
            <p className="text-xs text-destructive">{aiError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            자연어로 입력하면 자동으로 할 일을 생성합니다. (Enter 키로 생성)
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">
          제목 <span className="text-destructive">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="할 일 제목을 입력하세요"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          설명
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="할 일에 대한 상세 설명을 입력하세요"
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="due_date" className="text-sm font-medium">
            마감일
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="due_date"
              type="datetime-local"
              value={formData.due_date || ""}
              onChange={(e) =>
                handleChange("due_date", e.target.value || null)
              }
              className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="priority" className="text-sm font-medium">
            우선순위
          </label>
          <select
            id="priority"
            value={formData.priority}
            onChange={(e) => handleChange("priority", e.target.value as Priority)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isLoading}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="category" className="text-sm font-medium">
          카테고리
        </label>
        <div className="flex flex-wrap gap-2">
          {defaultCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleChange("category", cat)}
              className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                formData.category === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-muted"
              }`}
              disabled={isLoading}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={customCategory}
          onChange={(e) => {
            setCustomCategory(e.target.value);
            if (e.target.value) {
              handleChange("category", e.target.value);
            }
          }}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="또는 직접 입력"
          disabled={isLoading}
        />
      </div>

      {/* 반복 설정 */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          반복
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "none", label: "없음" },
            { value: "hourly", label: "매시간" },
            { value: "daily", label: "매일" },
            { value: "weekly", label: "매주" },
            { value: "monthly", label: "매달" },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={formData.repeat_type === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const newRepeatType = option.value as RepeatType;
                setFormData((prev) => ({
                  ...prev,
                  repeat_type: newRepeatType,
                  repeat_days_of_week: newRepeatType === "weekly" ? prev.repeat_days_of_week || [] : [],
                  repeat_end_date: newRepeatType !== "none" ? prev.repeat_end_date : null,
                }));
              }}
              disabled={isLoading}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* 매주 반복 시 요일 선택 */}
        {formData.repeat_type === "weekly" && (
          <div className="mt-3 space-y-2">
            <label className="text-xs text-muted-foreground">반복 요일 선택</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 0, label: "일" },
                { value: 1, label: "월" },
                { value: 2, label: "화" },
                { value: 3, label: "수" },
                { value: 4, label: "목" },
                { value: 5, label: "금" },
                { value: 6, label: "토" },
              ].map((day) => {
                const isSelected = formData.repeat_days_of_week?.includes(day.value) || false;
                return (
                  <Button
                    key={day.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const currentDays = formData.repeat_days_of_week || [];
                      const newDays = isSelected
                        ? currentDays.filter((d) => d !== day.value)
                        : [...currentDays, day.value].sort((a, b) => a - b);
                      setFormData((prev) => ({
                        ...prev,
                        repeat_days_of_week: newDays,
                      }));
                    }}
                    disabled={isLoading}
                    className="h-8 w-8 p-0"
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* 반복 종료일 설정 */}
        {formData.repeat_type !== "none" && (
          <div className="mt-3 space-y-2">
            <label htmlFor="repeat_end_date" className="text-xs text-muted-foreground">
              반복 종료일 (선택사항)
            </label>
            <input
              id="repeat_end_date"
              type="datetime-local"
              value={formData.repeat_end_date || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  repeat_end_date: e.target.value || null,
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {todo && (
        <div className="flex items-center gap-2">
          <input
            id="completed"
            type="checkbox"
            checked={formData.completed}
            onChange={(e) => handleChange("completed", e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
            disabled={isLoading}
          />
          <label htmlFor="completed" className="text-sm font-medium">
            완료됨
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isLoading}
          >
            취소
          </button>
        )}
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          disabled={isLoading || !formData.title.trim()}
        >
          {isLoading ? "저장 중..." : todo ? "수정" : "추가"}
        </button>
      </div>
    </form>
  );
}

