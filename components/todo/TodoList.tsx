"use client";

import { useState } from "react";
import { Todo } from "@/types/todo";
import TodoCard from "./TodoCard";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TodoListProps {
  todos: Todo[];
  onToggleComplete?: (id: string) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
  onReorder?: (todos: Todo[]) => void;
  emptyMessage?: string;
}

interface SortableTodoCardProps {
  todo: Todo;
  onToggleComplete?: (id: string) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
}

function SortableTodoCard({
  todo,
  onToggleComplete,
  onEdit,
  onDelete,
}: SortableTodoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TodoCard
        todo={todo}
        onToggleComplete={onToggleComplete}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

export default function TodoList({
  todos,
  onToggleComplete,
  onEdit,
  onDelete,
  onReorder,
  emptyMessage = "할 일이 없습니다.",
}: TodoListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이상 이동해야 드래그 시작 (버튼 클릭과 구분)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [draggedPriority, setDraggedPriority] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const draggedTodo = todos.find((todo) => todo.id === event.active.id);
    if (draggedTodo) {
      setDraggedPriority(draggedTodo.priority);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const draggedTodo = todos.find((todo) => todo.id === active.id);
    const targetTodo = todos.find((todo) => todo.id === over.id);

    // 우선순위가 다른 경우 드래그 오버 비활성화
    if (draggedTodo && targetTodo && draggedTodo.priority !== targetTodo.priority) {
      // 드래그 오버를 막기 위해 이벤트를 조작할 수 없으므로,
      // handleDragEnd에서 처리
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = todos.findIndex((todo) => todo.id === active.id);
    const newIndex = todos.findIndex((todo) => todo.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const draggedTodo = todos[oldIndex];
    const targetTodo = todos[newIndex];

    // 우선순위가 다른 경우 드래그 앤 드롭 무시
    if (draggedTodo.priority !== targetTodo.priority) {
      return;
    }

    // 같은 우선순위 내에서만 드래그 앤 드롭 허용
    const newTodos = arrayMove(todos, oldIndex, newIndex);
    onReorder?.(newTodos);
    
    // 드래그 완료 후 우선순위 초기화
    setDraggedPriority(null);
  };

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          className="mb-4 h-12 w-12 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {todos.map((todo) => (
            <SortableTodoCard
              key={todo.id}
              todo={todo}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
