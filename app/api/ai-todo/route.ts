import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    // API 키 검증
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const { text } = await request.json();

    // ========== 입력 검증 ==========
    // 1. 타입 및 빈 문자열 체크
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "입력 텍스트가 필요합니다." },
        { status: 400 }
      );
    }

    // 2. 전처리: 앞뒤 공백 제거, 연속된 공백을 하나로 통합
    let processedText = text.trim().replace(/\s+/g, " ");

    // 3. 빈 문자열 체크 (전처리 후)
    if (processedText.length === 0) {
      return NextResponse.json(
        { error: "입력 텍스트가 비어있습니다." },
        { status: 400 }
      );
    }

    // 4. 최소 길이 제한 (2자)
    if (processedText.length < 2) {
      return NextResponse.json(
        { error: "입력 텍스트는 최소 2자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 5. 최대 길이 제한 (500자)
    if (processedText.length > 500) {
      return NextResponse.json(
        { error: "입력 텍스트는 500자 이하여야 합니다. (현재: " + processedText.length + "자)" },
        { status: 400 }
      );
    }

    // 6. 특수 문자 및 이모지 체크 (경고만, 차단하지 않음)
    // 이모지와 특수 문자는 허용하되, 너무 많은 경우 경고
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/gu;
    const emojiCount = (processedText.match(emojiRegex) || []).length;
    if (emojiCount > 10) {
      return NextResponse.json(
        { error: "이모지가 너무 많습니다. 텍스트를 중심으로 입력해주세요." },
        { status: 400 }
      );
    }

    // 현재 날짜 정보를 포함한 프롬프트
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentDayOfWeek = now.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    
    // 날짜 계산
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];
    const dayAfterTomorrowDate = dayAfterTomorrow.toISOString().split("T")[0];
    
    // 요일 이름 매핑
    const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const currentDayName = dayNames[currentDayOfWeek];
    
    // 이번 주 요일 계산 함수 (가장 가까운 요일)
    const getThisWeekDay = (targetDay: number) => {
      const daysUntilTarget = (targetDay - currentDayOfWeek + 7) % 7;
      const daysToAdd = daysUntilTarget === 0 ? 7 : daysUntilTarget; // 오늘이면 다음 주
      const targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().split("T")[0];
    };
    
    // 다음 주 요일 계산 함수
    const getNextWeekDay = (targetDay: number) => {
      const daysUntilTarget = (targetDay - currentDayOfWeek + 7) % 7;
      const daysToAdd = daysUntilTarget === 0 ? 14 : (7 + daysUntilTarget);
      const targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().split("T")[0];
    };

    const prompt = `다음 자연어 입력을 할 일 관리 시스템의 구조화된 데이터로 변환해주세요.

현재 날짜: ${currentYear}년 ${currentMonth}월 ${currentDay}일 (${currentDate}, ${currentDayName})

입력 텍스트: "${processedText}"

=== 중요: 할 일 분할 규칙 ===
입력된 할 일이 복잡하거나 여러 단계가 필요한 경우, 자동으로 단계별로 나눠서 제공하세요.

**단일 할 일로 반환하는 경우:**
- 단순하고 즉시 실행 가능한 할 일
- 예: "이메일 보내기", "책 읽기", "친구에게 전화하기", "운동하기"

**여러 단계로 나눠서 반환하는 경우:**
- 복잡하고 여러 단계가 필요한 할 일
- 예: "프로젝트 완료하기" → ["1단계: 요구사항 분석", "2단계: 설계", "3단계: 구현", "4단계: 테스트"]
- 예: "회의 준비하기" → ["1단계: 자료 수집", "2단계: 발표 자료 작성", "3단계: 리허설"]
- 예: "보고서 작성하기" → ["1단계: 자료 조사", "2단계: 초안 작성", "3단계: 검토 및 수정"]
- 예: "웹사이트 만들기" → ["1단계: 기획 및 설계", "2단계: 디자인", "3단계: 개발", "4단계: 배포"]

**분할 기준:**
- 입력에 "준비", "완료", "작성", "만들기", "구현" 등의 복잡한 동사가 포함된 경우
- 입력에 여러 단계가 명시된 경우 (예: "1. ... 2. ... 3. ...")
- 입력이 추상적이고 구체적인 행동이 필요한 경우
- 각 단계는 독립적으로 실행 가능하고, 순서가 있는 경우 순서대로 배치

반드시 다음 JSON 형식으로만 응답하세요 (다른 설명이나 마크다운 없이 순수 JSON만):

단일 할 일인 경우:
{
  "todos": [
    {
      "title": "할 일 제목",
      "description": "상세 설명",
      "due_date": "YYYY-MM-DD 또는 null",
      "due_time": "HH:MM",
      "priority": "high" | "medium" | "low",
      "category": "업무" | "개인" | "건강" | "학습" | "기타"
    }
  ]
}

여러 단계로 나눠야 하는 경우:
{
  "todos": [
    {
      "title": "1단계: 첫 번째 단계 제목",
      "description": "상세 설명",
      "due_date": "YYYY-MM-DD 또는 null",
      "due_time": "HH:MM",
      "priority": "high" | "medium" | "low",
      "category": "업무" | "개인" | "건강" | "학습" | "기타"
    },
    {
      "title": "2단계: 두 번째 단계 제목",
      "description": "상세 설명",
      "due_date": "YYYY-MM-DD 또는 null",
      "due_time": "HH:MM",
      "priority": "high" | "medium" | "low",
      "category": "업무" | "개인" | "건강" | "학습" | "기타"
    }
  ]
}

=== 필수 규칙 (반드시 준수) ===

1. 날짜 처리 규칙:
   - "오늘" → ${currentDate}
   - "내일" → ${tomorrowDate}
   - "모레" → ${dayAfterTomorrowDate}
   - "이번 주 월요일" → ${getThisWeekDay(1)}
   - "이번 주 화요일" → ${getThisWeekDay(2)}
   - "이번 주 수요일" → ${getThisWeekDay(3)}
   - "이번 주 목요일" → ${getThisWeekDay(4)}
   - "이번 주 금요일" → ${getThisWeekDay(5)}
   - "이번 주 토요일" → ${getThisWeekDay(6)}
   - "이번 주 일요일" → ${getThisWeekDay(0)}
   - "다음 주 월요일" → ${getNextWeekDay(1)}
   - "다음 주 화요일" → ${getNextWeekDay(2)}
   - "다음 주 수요일" → ${getNextWeekDay(3)}
   - "다음 주 목요일" → ${getNextWeekDay(4)}
   - "다음 주 금요일" → ${getNextWeekDay(5)}
   - "다음 주 토요일" → ${getNextWeekDay(6)}
   - "다음 주 일요일" → ${getNextWeekDay(0)}
   - 날짜가 명시되지 않으면 null

2. 시간 처리 규칙:
   - "아침" → "09:00"
   - "점심" → "12:00"
   - "오후" → "14:00"
   - "저녁" → "18:00"
   - "밤" → "21:00"
   - "오전 9시" → "09:00", "오전 10시" → "10:00"
   - "오후 3시" → "15:00", "오후 3시 30분" → "15:30"
   - 구체적인 시간이 없으면 "09:00" (기본값)

3. 우선순위 키워드 (정확히 매칭):
   - "high": "급하게", "중요한", "빨리", "꼭", "반드시" 키워드가 포함된 경우
   - "medium": "보통", "적당히" 키워드가 있거나 키워드가 없는 경우
   - "low": "여유롭게", "천천히", "언젠가" 키워드가 포함된 경우

4. 카테고리 분류 키워드 (정확히 매칭):
   - "업무": "회의", "보고서", "프로젝트", "업무" 키워드가 포함된 경우
   - "개인": "쇼핑", "친구", "가족", "개인" 키워드가 포함된 경우
   - "건강": "운동", "병원", "건강", "요가" 키워드가 포함된 경우
   - "학습": "공부", "책", "강의", "학습" 키워드가 포함된 경우
   - 위 키워드가 없으면 "기타"

5. 출력 양식:
   - 반드시 유효한 JSON 형식만 응답
   - 마크다운 코드 블록, 설명, 주석 등 없이 순수 JSON만
   - 모든 필드는 반드시 포함되어야 함

제목은 핵심 키워드만 추출하여 간결하게 작성하고, 설명은 원본 텍스트를 기반으로 작성하세요.

**할 일 분할 예시:**

입력: "내일까지 중요한 프로젝트 완료하기"
출력:
{
  "todos": [
    {
      "title": "1단계: 프로젝트 요구사항 분석",
      "description": "프로젝트 목표와 요구사항을 정리하고 우선순위를 결정합니다.",
      "due_date": "${tomorrowDate}",
      "due_time": "09:00",
      "priority": "high",
      "category": "업무"
    },
    {
      "title": "2단계: 프로젝트 설계 및 계획 수립",
      "description": "전체 구조를 설계하고 세부 일정을 계획합니다.",
      "due_date": "${tomorrowDate}",
      "due_time": "12:00",
      "priority": "high",
      "category": "업무"
    },
    {
      "title": "3단계: 프로젝트 구현",
      "description": "설계한 계획에 따라 실제 작업을 수행합니다.",
      "due_date": "${tomorrowDate}",
      "due_time": "15:00",
      "priority": "high",
      "category": "업무"
    },
    {
      "title": "4단계: 프로젝트 검토 및 마무리",
      "description": "완성된 프로젝트를 검토하고 최종 점검을 합니다.",
      "due_date": "${tomorrowDate}",
      "due_time": "18:00",
      "priority": "high",
      "category": "업무"
    }
  ]
}

입력: "이메일 보내기"
출력:
{
  "todos": [
    {
      "title": "이메일 보내기",
      "description": "이메일을 작성하고 전송합니다.",
      "due_date": null,
      "due_time": "09:00",
      "priority": "medium",
      "category": "업무"
    }
  ]
}

반드시 todos 배열로 응답하고, 각 할 일은 독립적으로 실행 가능해야 합니다.`;

    let responseText: string;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that converts natural language input into structured JSON data for a todo management system. For complex tasks, automatically break them down into multiple step-by-step todos. Always respond with valid JSON only, no markdown or explanations. The response must be a JSON object with a 'todos' array containing one or more todo items.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const messageContent = completion.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error("AI가 응답을 생성하지 못했습니다.");
      }
      responseText = messageContent.trim();
    } catch (aiError: any) {
      console.error("AI API 호출 오류:", aiError);
      console.error("오류 상세:", {
        status: aiError.status,
        message: aiError.message,
        code: aiError.code,
        type: aiError.type,
      });

      // 모델명 오류
      if (
        aiError.message?.includes("model") ||
        aiError.message?.includes("not found") ||
        aiError.code === "model_not_found"
      ) {
        return NextResponse.json(
          { error: "AI 모델을 찾을 수 없습니다. 모델명을 확인해주세요." },
          { status: 400 }
        );
      }

      // API 키 오류
      if (
        aiError.status === 401 ||
        aiError.message?.includes("api key") ||
        aiError.message?.includes("authentication")
      ) {
        return NextResponse.json(
          { error: "AI API 키가 유효하지 않습니다. 환경변수를 확인해주세요." },
          { status: 401 }
        );
      }

      // API 호출 한도 초과 (429)
      if (
        aiError.status === 429 ||
        aiError.message?.includes("429") ||
        aiError.message?.includes("quota") ||
        aiError.message?.includes("rate limit")
      ) {
        return NextResponse.json(
          {
            error: "AI 서비스 사용 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.",
          },
          { status: 429 }
        );
      }

      // AI 처리 실패 (400)
      if (
        aiError.status === 400 ||
        aiError.message?.includes("400") ||
        aiError.message?.includes("invalid") ||
        aiError.message?.includes("bad request")
      ) {
        return NextResponse.json(
          {
            error: `AI가 입력을 처리할 수 없습니다: ${aiError.message || "알 수 없는 오류"}`,
          },
          { status: 400 }
        );
      }

      // 기타 AI 오류
      return NextResponse.json(
        {
          error: `AI 처리 중 오류가 발생했습니다: ${aiError.message || "알 수 없는 오류"}`,
        },
        { status: 500 }
      );
    }

    // JSON 추출 (마크다운 코드 블록 제거)
    let jsonText = responseText;
    if (jsonText.includes("```json")) {
      jsonText = jsonText.split("```json")[1].split("```")[0].trim();
    } else if (jsonText.includes("```")) {
      jsonText = jsonText.split("```")[1].split("```")[0].trim();
    }

    // JSON 파싱
    let parsedData;
    try {
      if (!jsonText || jsonText.trim().length === 0) {
        throw new Error("AI 응답이 비어있습니다.");
      }
      parsedData = JSON.parse(jsonText);
      
      // 필수 필드 검증
      if (!parsedData || typeof parsedData !== "object") {
        throw new Error("AI 응답이 유효한 JSON 객체가 아닙니다.");
      }
    } catch (parseError: any) {
      console.error("JSON 파싱 오류:", parseError);
      console.error("응답 텍스트:", responseText);
      return NextResponse.json(
        {
          error: `AI 응답 형식이 올바르지 않습니다: ${parseError.message || "JSON 파싱 실패"}`,
        },
        { status: 400 }
      );
    }

    // ========== 후처리 ==========
    // todos 배열 처리 (단일 또는 여러 할 일)
    const todosArray = Array.isArray(parsedData.todos) ? parsedData.todos : 
      // 기존 형식 호환성 (단일 할 일)
      parsedData.title ? [{
        title: parsedData.title,
        description: parsedData.description,
        due_date: parsedData.due_date,
        due_time: parsedData.due_time,
        priority: parsedData.priority,
        category: parsedData.category,
      }] : [];

    if (todosArray.length === 0) {
      return NextResponse.json(
        { error: "AI가 할 일을 생성하지 못했습니다. 다시 시도해주세요." },
        { status: 400 }
      );
    }

    const validatedTodos = todosArray.map((todo: any, index: number) => {
      // 1. 제목 자동 조정
      let title = String(todo.title || processedText).trim();
      if (title.length === 0) {
        title = processedText.substring(0, 50);
      }
      if (title.length < 2) {
        title = processedText.substring(0, 50);
      }
      if (title.length > 100) {
        title = title.substring(0, 97) + "...";
      }

      // 2. 설명 기본값 설정
      let description = String(todo.description || "").trim();
      if (description.length > 1000) {
        description = description.substring(0, 997) + "...";
      }

      // 3. 우선순위 기본값 설정
      const validPriorities = ["high", "medium", "low"];
      const priority = validPriorities.includes(todo.priority)
        ? todo.priority
        : "medium";

      // 4. 카테고리 기본값 설정
      const validCategories = ["업무", "개인", "건강", "학습", "기타"];
      let category = String(todo.category || "기타").trim();
      if (!validCategories.includes(category)) {
        category = "기타";
      }

      // 5. 시간 기본값 설정
      let dueTime = String(todo.due_time || "09:00").trim();
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(dueTime)) {
        dueTime = "09:00";
      }

      // 6. 날짜 처리 및 과거 날짜 체크
      let finalDueDate: string | null = null;
      if (todo.due_date) {
        try {
          const [hours, minutes] = dueTime.split(":").map(Number);
          const dueDateObj = new Date(todo.due_date);
          
          if (isNaN(dueDateObj.getTime())) {
            finalDueDate = null;
          } else {
            dueDateObj.setHours(hours || 9, minutes || 0, 0, 0);
            
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            
            if (dueDateObj < oneHourAgo) {
              // 여러 단계인 경우 날짜를 순차적으로 배치
              if (todosArray.length > 1) {
                const daysOffset = index; // 각 단계를 하루씩 늦춤
                const adjustedDate = new Date(now);
                adjustedDate.setDate(adjustedDate.getDate() + daysOffset);
                adjustedDate.setHours(hours || 9, minutes || 0, 0, 0);
                finalDueDate = adjustedDate.toISOString();
              } else {
                const today = new Date();
                today.setHours(hours || 9, minutes || 0, 0, 0);
                finalDueDate = today.toISOString();
              }
            } else {
              finalDueDate = dueDateObj.toISOString();
            }
          }
        } catch (dateError) {
          console.error("날짜 변환 오류:", dateError);
          finalDueDate = null;
        }
      }

      return {
        title: title || processedText.substring(0, 50),
        description: description || "",
        due_date: finalDueDate,
        priority: priority,
        category: category,
        completed: false,
      };
    });

    return NextResponse.json({
      todos: validatedTodos,
    });
  } catch (error: any) {
    console.error("AI 할 일 생성 오류:", error);

    // 요청 본문 파싱 오류
    if (error instanceof SyntaxError || error.message?.includes("JSON")) {
      return NextResponse.json(
        { error: "잘못된 요청 형식입니다. 입력 데이터를 확인해주세요." },
        { status: 400 }
      );
    }

    // API 키 오류
    if (error.message?.includes("API_KEY") || error.message?.includes("api key")) {
      return NextResponse.json(
        { error: "AI 서비스 설정 오류가 발생했습니다. 관리자에게 문의해주세요." },
        { status: 500 }
      );
    }

    // 네트워크 오류
    if (
      error.message?.includes("fetch") ||
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED")
    ) {
      return NextResponse.json(
        { error: "네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 기타 오류
    return NextResponse.json(
      {
        error: "예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 }
    );
  }
}
