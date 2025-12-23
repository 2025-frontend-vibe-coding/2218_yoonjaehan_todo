"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Search, Filter, ArrowUpDown, LogOut, User, Settings, BarChart3, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { TodoForm } from "@/components/todo";
import { TodoList } from "@/components/todo";
import { Todo, TodoFormData, Priority } from "@/types/todo";
import { TodoSummary } from "@/types/summary";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useConfirmDialog } from "@/components/ui/dialog";

type FilterStatus = "all" | "진행 중" | "완료" | "지연" | "미완료";
type SortOption = "priority" | "due_date" | "created_date" | "title";

export default function HomePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosOrder, setTodosOrder] = useState<Map<string, number>>(new Map()); // 드래그 앤 드롭 순서 저장
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortOption, setSortOption] = useState<SortOption>("priority");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [summaryTab, setSummaryTab] = useState<"today" | "week">("today");
  const [summary, setSummary] = useState<TodoSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // 에러 처리 함수
  const handleError = (error: any) => {
    if (error.code === "PGRST301" || error.message?.includes("JWT") || error.message?.includes("token")) {
      // 인증 만료
      addToast({
        type: "error",
        title: "인증 만료",
        description: "인증이 만료되었습니다. 다시 로그인해주세요.",
      });
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } else if (error.message?.includes("network") || error.message?.includes("fetch") || error.message?.includes("NetworkError")) {
      // 네트워크 오류
      addToast({
        type: "error",
        title: "네트워크 오류",
        description: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.",
      });
    } else {
      addToast({
        type: "error",
        title: "오류 발생",
        description: error.message || "오류가 발생했습니다. 다시 시도해주세요.",
      });
    }
  };

  // 할 일 목록 다시 불러오기 함수
  const reloadTodos = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    try {
      const { data: todosData, error: todosError } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", session.user.id)
        .order("priority", { ascending: false })
        .order("created_date", { ascending: false });

      if (todosError) {
        // position 필드 관련 에러인 경우 기본 정렬로 재시도
        if (todosError.message?.includes("position") || todosError.code === "42703") {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("todos")
            .select("*")
            .eq("user_id", session.user.id)
            .order("priority", { ascending: false })
            .order("created_date", { ascending: false });
          
          if (fallbackError) {
            handleError(fallbackError);
            return;
          }
          
          // position 필드가 없는 경우 기본값 설정
          const todosWithPosition = (fallbackData || []).map((todo: Todo, index: number) => ({
            ...todo,
            position: (todo as any).position ?? index + 1,
          }));
          setTodos(todosWithPosition);
          return;
        }
        
        handleError(todosError);
        return;
      }

      // position 필드가 없는 경우 기본값 설정
      const todosWithPosition = (todosData || []).map((todo: Todo, index: number) => ({
        ...todo,
        position: (todo as any).position ?? index + 1,
      }));
      setTodos(todosWithPosition);
    } catch (err: any) {
      handleError(err);
    }
  };

  // 사용자 정보 및 할 일 목록 로드
  useEffect(() => {
    const loadUserAndTodos = async () => {
      const supabase = createClient();
      
      // 현재 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
        router.push("/login");
        return;
      }

      // 사용자 정보 가져오기
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("email, name")
        .eq("id", session.user.id)
        .single();

      if (userError) {
        console.error("Error fetching user:", userError);
        // 사용자 정보를 가져오지 못해도 이메일은 표시
        setCurrentUser({
          email: session.user.email || "이메일 없음",
          name: session.user.user_metadata?.name || "사용자",
        });
      } else {
        setCurrentUser({
          email: userData?.email || session.user.email || "이메일 없음",
          name: userData?.name || session.user.user_metadata?.name || "사용자",
        });
      }

      // 할 일 목록 가져오기
      // position 필드가 없을 수 있으므로 안전하게 처리
      const { data: todosData, error: todosError } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", session.user.id)
        .order("priority", { ascending: false })
        .order("created_date", { ascending: false });

      if (todosError) {
        console.error("Error fetching todos:", todosError);
        // position 필드 관련 에러인 경우 기본 정렬로 재시도
        if (todosError.message?.includes("position") || todosError.code === "42703") {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("todos")
            .select("*")
            .eq("user_id", session.user.id)
            .order("priority", { ascending: false })
            .order("created_date", { ascending: false });
          
          if (fallbackError) {
            handleError(fallbackError);
            setTodos([]);
          } else {
            // position 필드가 없는 경우 기본값 설정
            const todosWithPosition = (fallbackData || []).map((todo: Todo, index: number) => ({
              ...todo,
              position: (todo as any).position ?? index + 1,
            }));
            setTodos(todosWithPosition);
          }
        } else {
          handleError(todosError);
          setTodos([]);
        }
      } else {
        // position 필드가 없는 경우 기본값 설정
        const todosWithPosition = (todosData || []).map((todo: Todo, index: number) => ({
          ...todo,
          position: (todo as any).position ?? index + 1,
        }));
        setTodos(todosWithPosition);
      }

      setIsLoading(false);
    };

    loadUserAndTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // 검색, 필터, 정렬 적용
  const filteredAndSortedTodos = useMemo(() => {
    let filtered = todos;

    // 검색 필터 (제목만 검색)
    if (searchQuery) {
      filtered = filtered.filter((todo) =>
        todo.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 우선순위 필터
    if (priorityFilter !== "all") {
      filtered = filtered.filter((todo) => todo.priority === priorityFilter);
    }

    // 상태 필터
    if (statusFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((todo) => {
        if (statusFilter === "완료") {
          return todo.completed;
        }
        if (statusFilter === "미완료") {
          return !todo.completed;
        }
        if (statusFilter === "진행 중") {
          return !todo.completed && (!todo.due_date || new Date(todo.due_date) >= now);
        }
        if (statusFilter === "지연") {
          return !todo.completed && todo.due_date && new Date(todo.due_date) < now;
        }
        return true;
      });
    }

    // 정렬
    // 드래그 앤 드롭으로 순서가 변경된 경우 순서 유지
    const sorted = [...filtered].sort((a, b) => {
      // 사용자가 드래그 앤 드롭으로 순서를 변경한 경우 그 순서를 우선
      const aOrder = todosOrder.get(a.id);
      const bOrder = todosOrder.get(b.id);
      
      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder;
      }
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      
      // 드래그 앤 드롭 순서가 없으면 기존 정렬 로직 사용
      if (sortOption === "priority") {
        const priorityOrder: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        // 같은 우선순위면 position으로 정렬
        const aPos = a.position || 0;
        const bPos = b.position || 0;
        return aPos - bPos;
      }
      if (sortOption === "due_date") {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (sortOption === "created_date") {
        return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
      }
      if (sortOption === "title") {
        return a.title.localeCompare(b.title, "ko");
      }
      // 기본 정렬: 우선순위 -> position
      const priorityOrder: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const aPos = a.position || 0;
      const bPos = b.position || 0;
      return aPos - bPos;
    });

    return sorted;
  }, [todos, todosOrder, searchQuery, priorityFilter, statusFilter, sortOption]);

  const handleAddTodo = async (formData: TodoFormData) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push("/login");
      return;
    }

    try {
      // 같은 우선순위 내에서 최대 position 값 찾기 (position 필드가 없을 수 있으므로 안전하게 처리)
      let nextPosition = 1;
      try {
        const { data: maxPositionData } = await supabase
          .from("todos")
          .select("position")
          .eq("user_id", session.user.id)
          .eq("priority", formData.priority)
          .order("position", { ascending: false })
          .limit(1)
          .single();

        nextPosition = (maxPositionData?.position || 0) + 1;
      } catch {
        // position 필드가 없으면 기본값 사용
        nextPosition = 1;
      }

      // 반복 종료일 자동 설정 (반복이 설정된 경우)
      let repeatEndDate = formData.repeat_end_date || null;
      if (formData.repeat_type && formData.repeat_type !== "none" && !repeatEndDate) {
        // 기본적으로 1년 후로 설정
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        repeatEndDate = endDate.toISOString();
      }

      // 기본 필수 필드만 포함
      const insertData: Record<string, unknown> = {
        user_id: session.user.id,
        title: formData.title,
        description: formData.description || null,
        due_date: formData.due_date || null,
        priority: formData.priority,
        category: formData.category || null,
        completed: formData.completed,
      };

      // position 필드가 있는지 확인 후 추가 (에러가 없으면 필드가 존재한다고 가정)
      try {
        const testQuery = await supabase
          .from("todos")
          .select("position")
          .limit(0);
        
        if (!testQuery.error) {
          insertData.position = nextPosition;
        }
      } catch {
        // position 필드가 없으면 무시
      }

      // 반복 필드가 있는지 확인 후 추가
      if (formData.repeat_type && formData.repeat_type !== "none") {
        try {
          const testQuery = await supabase
            .from("todos")
            .select("repeat_type")
            .limit(0);
          
          if (!testQuery.error) {
            insertData.repeat_type = formData.repeat_type;
            insertData.repeat_interval = formData.repeat_interval || 1;
            insertData.repeat_days_of_week = formData.repeat_days_of_week || null;
            insertData.repeat_end_date = repeatEndDate;
          }
        } catch {
          // 반복 필드가 없으면 무시
        }
      }

      const { data, error } = await supabase
        .from("todos")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Todo insert error:", error);
        handleError(error);
        return;
      }

      // 반복 할 일이면 자동 생성
      if (formData.repeat_type && formData.repeat_type !== "none") {
        await generateRecurringTodos(data.id, formData, session.user.id);
      }

      // 목록 다시 불러오기
      await reloadTodos();
      setEditingTodo(null);
      addToast({
        type: "success",
        title: "추가 완료",
        description: "할 일이 성공적으로 추가되었습니다.",
      });
    } catch (err: any) {
      handleError(err);
    }
  };

  // 여러 할 일을 한 번에 저장하는 함수
  const handleAddMultipleTodos = async (todosData: TodoFormData[]) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push("/login");
      return;
    }

    try {
      // 각 할 일의 position 계산 (position 필드가 없을 수 있으므로 안전하게 처리)
      const todosToInsert = await Promise.all(
        todosData.map(async (formData, index) => {
          let nextPosition = index + 1;
          try {
            const { data: maxPositionData } = await supabase
              .from("todos")
              .select("position")
              .eq("user_id", session.user.id)
              .eq("priority", formData.priority)
              .order("position", { ascending: false })
              .limit(1)
              .single();

            nextPosition = (maxPositionData?.position || 0) + index + 1;
          } catch {
            // position 필드가 없으면 기본값 사용
            nextPosition = index + 1;
          }

          let repeatEndDate = formData.repeat_end_date || null;
          if (formData.repeat_type && formData.repeat_type !== "none" && !repeatEndDate) {
            const endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1);
            repeatEndDate = endDate.toISOString();
          }

          // 기본 필수 필드만 포함
          const todoData: Record<string, unknown> = {
            user_id: session.user.id,
            title: formData.title,
            description: formData.description || null,
            due_date: formData.due_date || null,
            priority: formData.priority,
            category: formData.category || null,
            completed: formData.completed,
          };

          // position 필드가 있으면 추가
          if (nextPosition > 0) {
            try {
              const testQuery = await supabase
                .from("todos")
                .select("position")
                .limit(0);
              
              if (!testQuery.error) {
                todoData.position = nextPosition;
              }
            } catch {
              // position 필드가 없으면 무시
            }
          }

          // 반복 필드가 있으면 추가
          if (formData.repeat_type && formData.repeat_type !== "none") {
            try {
              const testQuery = await supabase
                .from("todos")
                .select("repeat_type")
                .limit(0);
              
              if (!testQuery.error) {
                todoData.repeat_type = formData.repeat_type;
                todoData.repeat_interval = formData.repeat_interval || 1;
                todoData.repeat_days_of_week = formData.repeat_days_of_week || null;
                todoData.repeat_end_date = repeatEndDate;
              }
            } catch {
              // 반복 필드가 없으면 무시
            }
          }

          return todoData;
        })
      );

      const { data, error } = await supabase
        .from("todos")
        .insert(todosToInsert)
        .select();

      if (error) {
        handleError(error);
        return;
      }

      // 반복 할 일 자동 생성
      if (data) {
        for (let i = 0; i < data.length; i++) {
          const todo = data[i];
          const formData = todosData[i];
          if (formData.repeat_type && formData.repeat_type !== "none") {
            await generateRecurringTodos(todo.id, formData, session.user.id);
          }
        }
      }

      // 목록 다시 불러오기
      await reloadTodos();
      addToast({
        type: "success",
        title: "생성 완료",
        description: `${todosData.length}개의 할 일이 성공적으로 생성되었습니다.`,
      });
    } catch (err: any) {
      handleError(err);
    }
  };

  // 반복 할 일 자동 생성 함수
  const generateRecurringTodos = async (
    parentTodoId: string,
    formData: TodoFormData,
    userId: string
  ) => {
    if (!formData.repeat_type || formData.repeat_type === "none") return;

    const supabase = createClient();
    const now = new Date();
    const baseDate = formData.due_date ? new Date(formData.due_date) : now;
    const endDate = formData.repeat_end_date
      ? new Date(formData.repeat_end_date)
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    const todosToCreate: any[] = [];
    let currentDate = new Date(baseDate);

    if (formData.repeat_type === "hourly") {
      while (currentDate <= endDate && todosToCreate.length < 100) {
        // 최대 100개로 제한
        if (currentDate > now) {
          todosToCreate.push({
            user_id: userId,
            title: formData.title,
            description: formData.description || null,
            due_date: currentDate.toISOString(),
            priority: formData.priority,
            category: formData.category || null,
            completed: false,
            parent_todo_id: parentTodoId,
            repeat_type: "none", // 생성된 할 일은 반복 없음
            position: 0,
          });
        }
        currentDate.setHours(currentDate.getHours() + (formData.repeat_interval || 1));
      }
    } else if (formData.repeat_type === "daily") {
      while (currentDate <= endDate && todosToCreate.length < 365) {
        // 최대 365개로 제한
        if (currentDate > now) {
          todosToCreate.push({
            user_id: userId,
            title: formData.title,
            description: formData.description || null,
            due_date: currentDate.toISOString(),
            priority: formData.priority,
            category: formData.category || null,
            completed: false,
            parent_todo_id: parentTodoId,
            repeat_type: "none",
            position: 0,
          });
        }
        currentDate.setDate(currentDate.getDate() + (formData.repeat_interval || 1));
      }
    } else if (formData.repeat_type === "weekly") {
      const selectedDays = formData.repeat_days_of_week || [];
      if (selectedDays.length === 0) {
        // 요일이 선택되지 않았으면 기본적으로 같은 요일
        selectedDays.push(baseDate.getDay());
      }

      while (currentDate <= endDate && todosToCreate.length < 52) {
        // 최대 52주로 제한
        const dayOfWeek = currentDate.getDay();
        if (selectedDays.includes(dayOfWeek) && currentDate > now) {
          todosToCreate.push({
            user_id: userId,
            title: formData.title,
            description: formData.description || null,
            due_date: currentDate.toISOString(),
            priority: formData.priority,
            category: formData.category || null,
            completed: false,
            parent_todo_id: parentTodoId,
            repeat_type: "none",
            position: 0,
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (formData.repeat_type === "monthly") {
      while (currentDate <= endDate && todosToCreate.length < 12) {
        // 최대 12개로 제한
        if (currentDate > now) {
          todosToCreate.push({
            user_id: userId,
            title: formData.title,
            description: formData.description || null,
            due_date: currentDate.toISOString(),
            priority: formData.priority,
            category: formData.category || null,
            completed: false,
            parent_todo_id: parentTodoId,
            repeat_type: "none",
            position: 0,
          });
        }
        currentDate.setMonth(currentDate.getMonth() + (formData.repeat_interval || 1));
      }
    }

    if (todosToCreate.length > 0) {
      await supabase.from("todos").insert(todosToCreate);
    }
  };

  // 할 일 순서 변경 함수 (낙관적 업데이트)
  const handleReorder = async (reorderedTodos: Todo[]) => {
    // 드래그 앤 드롭 순서를 Map에 저장
    const newOrder = new Map<string, number>();
    reorderedTodos.forEach((todo, index) => {
      newOrder.set(todo.id, index);
    });
    setTodosOrder(newOrder);
    
    // 즉시 로컬 상태 업데이트 (낙관적 업데이트)
    setTodos(reorderedTodos);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    // 백그라운드에서 서버 업데이트 수행
    (async () => {
      try {
        // 우선순위별로 그룹화하여 position 업데이트
        const priorityGroups: Record<string, Todo[]> = {
          high: [],
          medium: [],
          low: [],
        };

        reorderedTodos.forEach((todo) => {
          priorityGroups[todo.priority].push(todo);
        });

        // position 필드가 있는지 먼저 확인
        const { error: testError } = await supabase
          .from("todos")
          .select("position")
          .limit(0);

        if (testError && (testError.message?.includes("position") || testError.code === "42703" || testError.code === "PGRST116")) {
          // position 필드가 없으면 순서 변경을 건너뛰기 (이미 로컬 상태는 업데이트됨)
          console.warn("Position field not available. Drag and drop order will not be saved.");
          return;
        }

        // 각 우선순위 그룹별로 position 업데이트
        for (const [, groupTodos] of Object.entries(priorityGroups)) {
          for (let i = 0; i < groupTodos.length; i++) {
            const todo = groupTodos[i];
            const { error } = await supabase
              .from("todos")
              .update({ position: i + 1 })
              .eq("id", todo.id)
              .eq("user_id", session.user.id);

            if (error) {
              console.error(`Error updating position for todo ${todo.id}:`, error);
              // 에러가 발생해도 계속 진행
            }
          }
        }

        // 서버에서 최신 데이터 다시 불러오기 (선택적)
        // await reloadTodos();
      } catch (err: unknown) {
        // 예상치 못한 에러는 조용히 처리 (이미 로컬 상태는 업데이트됨)
        const error = err as { message?: string; code?: string };
        if (!error.message?.includes("position") && error.code !== "42703") {
          console.error("Error updating todo order:", error);
        }
        // 에러가 발생해도 로컬 상태는 이미 업데이트되었으므로 사용자 경험에 영향 없음
      }
    })();
  };

  const handleUpdateTodo = async (formData: TodoFormData) => {
    if (!editingTodo) return;

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    // 본인 소유 확인
    if (editingTodo.user_id !== session.user.id) {
      addToast({
        type: "error",
        title: "권한 없음",
        description: "본인의 할 일만 수정할 수 있습니다.",
      });
      return;
    }

    try {
      // 반복 종료일 자동 설정
      let repeatEndDate = formData.repeat_end_date || null;
      if (formData.repeat_type && formData.repeat_type !== "none" && !repeatEndDate) {
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        repeatEndDate = endDate.toISOString();
      }

      const { error } = await supabase
        .from("todos")
        .update({
          title: formData.title,
          description: formData.description || null,
          due_date: formData.due_date || null,
          priority: formData.priority,
          category: formData.category || null,
          completed: formData.completed,
          repeat_type: formData.repeat_type || "none",
          repeat_interval: formData.repeat_interval || 1,
          repeat_days_of_week: formData.repeat_days_of_week || null,
          repeat_end_date: repeatEndDate,
        })
        .eq("id", editingTodo.id)
        .eq("user_id", session.user.id); // 본인 소유만 수정 가능

      if (error) {
        handleError(error);
        return;
      }

      // 목록 다시 불러오기
      await reloadTodos();
      setEditingTodo(null);
      addToast({
        type: "success",
        title: "수정 완료",
        description: "할 일이 성공적으로 수정되었습니다.",
      });
    } catch (err: any) {
      handleError(err);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    confirm(
      "할 일 삭제",
      "정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        // 본인 소유 확인
        const todo = todos.find((t) => t.id === id);
        if (todo && todo.user_id !== session.user.id) {
          addToast({
            type: "error",
            title: "권한 없음",
            description: "본인의 할 일만 삭제할 수 있습니다.",
          });
          return;
        }

        try {
          const { error } = await supabase
            .from("todos")
            .delete()
            .eq("id", id)
            .eq("user_id", session.user.id); // 본인 소유만 삭제 가능

          if (error) {
            handleError(error);
            return;
          }

          // 목록 다시 불러오기
          await reloadTodos();
          addToast({
            type: "success",
            title: "삭제 완료",
            description: "할 일이 성공적으로 삭제되었습니다.",
          });
        } catch (err: any) {
          handleError(err);
        }
      }
    );
  };

  const handleToggleComplete = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    // 본인 소유 확인
    if (todo.user_id !== session.user.id) {
      addToast({
        type: "error",
        title: "권한 없음",
        description: "본인의 할 일만 수정할 수 있습니다.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("todos")
        .update({ completed: !todo.completed })
        .eq("id", id)
        .eq("user_id", session.user.id); // 본인 소유만 수정 가능

      if (error) {
        handleError(error);
        return;
      }

      // 목록 다시 불러오기
      await reloadTodos();
      const updatedTodo = todos.find((t) => t.id === id);
      addToast({
        type: "success",
        title: !todo.completed ? "완료 처리" : "미완료 처리",
        description: !todo.completed
          ? "할 일이 완료 처리되었습니다."
          : "할 일이 미완료 처리되었습니다.",
      });
    } catch (err: any) {
      handleError(err);
    }
  };

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
  };

  const handleCancelEdit = () => {
    setEditingTodo(null);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error("Logout error:", error);
    } else {
      router.push("/login");
      router.refresh();
    }
  };

  // AI 요약 생성 함수
  const handleGenerateSummary = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    setIsSummaryLoading(true);
    setSummaryError(null);

    try {
      // 기간별 할 일 필터링
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 이번 주 월요일

      let filteredTodos = todos;

      if (summaryTab === "today") {
        // 오늘의 요약: 오늘 생성된 할 일 또는 오늘 마감인 할 일
        filteredTodos = todos.filter((todo) => {
          const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
          
          // 오늘 생성된 할 일
          if (todo.created_date) {
            const createdDate = new Date(todo.created_date);
            if (createdDate >= todayStart && createdDate < todayEnd) {
              return true;
            }
          }
          
          // 오늘 마감인 할 일
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date);
            if (dueDate >= todayStart && dueDate < todayEnd) {
              return true;
            }
          }
          
          return false;
        });
      } else {
        // 이번 주 (월요일 ~ 일요일): 이번 주에 생성되거나 마감인 할 일
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        filteredTodos = todos.filter((todo) => {
          // 이번 주에 생성된 할 일
          if (todo.created_date) {
            const createdDate = new Date(todo.created_date);
            if (createdDate >= weekStart && createdDate < weekEnd) {
              return true;
            }
          }
          
          // 이번 주에 마감인 할 일
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date);
            if (dueDate >= weekStart && dueDate < weekEnd) {
              return true;
            }
          }
          
          return false;
        });
      }

      // API 호출
      const response = await fetch("/api/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          todos: filteredTodos.map((todo) => ({
            id: todo.id,
            title: todo.title,
            description: todo.description,
            due_date: todo.due_date,
            priority: todo.priority,
            category: todo.category,
            completed: todo.completed,
            created_date: todo.created_date,
          })),
          period: summaryTab,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "알 수 없는 오류가 발생했습니다." }));
        throw new Error(errorData.error || `서버 오류 (${response.status})`);
      }

      const data = await response.json();

      if (!data || !data.summary) {
        throw new Error("AI가 유효한 요약을 생성하지 못했습니다. 다시 시도해주세요.");
      }

      setSummary(data);
      setSummaryError(null);
    } catch (err: any) {
      console.error("Summary generation error:", err);
      const errorMessage = err.message || "요약 생성 중 오류가 발생했습니다.";
      setSummaryError(errorMessage);
      addToast({
        type: "error",
        title: "요약 생성 실패",
        description: errorMessage,
      });
    } finally {
      setIsSummaryLoading(false);
    }
  };

  // 로딩 중이거나 사용자 정보가 없으면 로딩 표시
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">할 일 관리</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{currentUser?.email}</span>
            </div>
            <Link href="/profile">
              <Button variant="ghost" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                마이페이지
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* 확인 다이얼로그 */}
      <ConfirmDialog />

      {/* Toolbar */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* 검색 */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="제목으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 필터 및 정렬 */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
                >
                  <option value="all">전체 상태</option>
                  <option value="미완료">미완료</option>
                  <option value="완료">완료</option>
                  <option value="진행 중">진행 중</option>
                  <option value="지연">지연</option>
                </Select>
              </div>
              <Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as Priority | "all")}
              >
                <option value="all">전체 우선순위</option>
                <option value="high">높음</option>
                <option value="medium">중간</option>
                <option value="low">낮음</option>
              </Select>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                >
                  <option value="priority">우선순위순</option>
                  <option value="due_date">마감일순</option>
                  <option value="created_date">생성일순</option>
                  <option value="title">제목순</option>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI 요약 및 분석 섹션 */}
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">AI 요약 및 분석</h2>
              </div>
              <Button
                onClick={handleGenerateSummary}
                disabled={isSummaryLoading || todos.length === 0}
                size="sm"
              >
                {isSummaryLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI 요약
                  </>
                )}
              </Button>
            </div>

            {/* 탭 */}
            <div className="mb-4 flex gap-2 border-b">
              <button
                onClick={() => {
                  setSummaryTab("today");
                  setSummary(null);
                  setSummaryError(null);
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  summaryTab === "today"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                오늘의 요약
              </button>
              <button
                onClick={() => {
                  setSummaryTab("week");
                  setSummary(null);
                  setSummaryError(null);
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  summaryTab === "week"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                이번 주 요약
              </button>
            </div>

            {/* 요약 결과 */}
            {summaryError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {summaryError}
              </div>
            )}

            {summary && !summaryError && (
              <div className="space-y-4">
                {/* 전체 요약 */}
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="mb-2 font-semibold">📊 요약</h3>
                  <p className="text-sm text-muted-foreground">{summary.summary}</p>
                </div>

                {/* 긴급 작업 */}
                {summary.urgentTasks.length > 0 && (
                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="mb-2 font-semibold">⚠️ 긴급 작업</h3>
                    <ul className="space-y-1 text-sm">
                      {summary.urgentTasks.map((task, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="text-primary">•</span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 인사이트 */}
                {summary.insights.length > 0 && (
                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="mb-2 font-semibold">💡 인사이트</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {summary.insights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 추천 사항 */}
                {summary.recommendations.length > 0 && (
                  <div className="rounded-lg border bg-card p-4">
                    <h3 className="mb-2 font-semibold">✨ 추천 사항</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {summary.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!summary && !summaryError && !isSummaryLoading && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <BarChart3 className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {summaryTab === "today" ? "오늘의" : "이번 주"} 할 일 분석을 시작하려면 &quot;AI 요약&quot; 버튼을 클릭하세요.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Main Area */}
      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 좌측(데스크톱) / 상단(모바일): TodoForm */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 p-6">
              <h2 className="mb-4 text-lg font-semibold">
                {editingTodo ? "할 일 수정" : "할 일 추가"}
              </h2>
              <TodoForm
                todo={editingTodo}
                onSubmit={editingTodo ? handleUpdateTodo : handleAddTodo}
                onCancel={editingTodo ? handleCancelEdit : undefined}
                onAutoSave={!editingTodo ? handleAddMultipleTodos : undefined}
              />
            </Card>
          </div>

          {/* 우측(데스크톱) / 하단(모바일): TodoList */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                할 일 목록 ({filteredAndSortedTodos.length})
              </h2>
            </div>
            <TodoList
              todos={filteredAndSortedTodos}
              onToggleComplete={handleToggleComplete}
              onEdit={handleEditTodo}
              onDelete={handleDeleteTodo}
              onReorder={handleReorder}
              emptyMessage={
                searchQuery || priorityFilter !== "all" || statusFilter !== "all"
                  ? "검색 결과가 없습니다."
                  : "할 일이 없습니다. 새로운 할 일을 추가해보세요!"
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
