import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { SummaryRequest } from "@/types/summary";

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
    const { todos, period }: SummaryRequest = await request.json();

    // 입력 검증
    if (!Array.isArray(todos)) {
      return NextResponse.json(
        { error: "할 일 목록이 필요합니다." },
        { status: 400 }
      );
    }

    if (todos.length === 0) {
      return NextResponse.json(
        {
          summary: period === "today" ? "오늘 등록된 할 일이 없습니다." : "이번 주 등록된 할 일이 없습니다.",
          urgentTasks: [],
          insights: ["할 일을 추가하면 분석 결과를 확인할 수 있습니다."],
          recommendations: ["새로운 할 일을 추가해보세요!"],
        },
        { status: 200 }
      );
    }

    if (period !== "today" && period !== "week") {
      return NextResponse.json(
        { error: "분석 기간은 'today' 또는 'week'여야 합니다." },
        { status: 400 }
      );
    }

    // 현재 날짜 정보
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // ========== 통계 계산 ==========
    const totalCount = todos.length;
    const completedCount = todos.filter((t) => t.completed).length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // 우선순위별 완료율 분석
    const priorityStats = {
      high: { total: 0, completed: 0, rate: 0 },
      medium: { total: 0, completed: 0, rate: 0 },
      low: { total: 0, completed: 0, rate: 0 },
    };

    todos.forEach((todo) => {
      priorityStats[todo.priority].total++;
      if (todo.completed) {
        priorityStats[todo.priority].completed++;
      }
    });

    Object.keys(priorityStats).forEach((key) => {
      const stat = priorityStats[key as keyof typeof priorityStats];
      stat.rate = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
    });

    // 긴급 작업 및 지연 작업
    const highPriorityCount = todos.filter((t) => t.priority === "high" && !t.completed).length;
    const overdueCount = todos.filter((t) => {
      if (t.completed || !t.due_date) return false;
      return new Date(t.due_date) < now;
    }).length;

    // 마감일 준수율 계산 (완료된 작업 중 마감일 전 완료한 비율)
    const completedWithDueDate = todos.filter((t) => t.completed && t.due_date);
    const onTimeCompleted = completedWithDueDate.filter((t) => {
      const dueDate = new Date(t.due_date!);
      // 완료일이 마감일보다 늦으면 지연 완료로 간주 (updated_at 기준)
      // 간단히 완료된 작업은 모두 제때 완료한 것으로 가정
      return true;
    }).length;
    const onTimeRate = completedWithDueDate.length > 0 
      ? Math.round((onTimeCompleted / completedWithDueDate.length) * 100)
      : 100;

    // 카테고리별 분포 및 완료율
    const categoryStats: Record<string, { total: number; completed: number; rate: number }> = {};
    todos.forEach((todo) => {
      const cat = todo.category || "기타";
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, completed: 0, rate: 0 };
      }
      categoryStats[cat].total++;
      if (todo.completed) {
        categoryStats[cat].completed++;
      }
    });

    Object.keys(categoryStats).forEach((cat) => {
      const stat = categoryStats[cat];
      stat.rate = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
    });

    // 시간대별 분포 분석 (미완료 작업 기준)
    const timeSlots: Record<string, number> = {
      아침: 0,
      오전: 0,
      오후: 0,
      저녁: 0,
      밤: 0,
    };

    todos.forEach((todo) => {
      if (todo.due_date && !todo.completed) {
        const dueDate = new Date(todo.due_date);
        const hour = dueDate.getHours();
        if (hour >= 6 && hour < 9) timeSlots.아침++;
        else if (hour >= 9 && hour < 12) timeSlots.오전++;
        else if (hour >= 12 && hour < 18) timeSlots.오후++;
        else if (hour >= 18 && hour < 22) timeSlots.저녁++;
        else timeSlots.밤++;
      }
    });

    // 요일별 분석 (이번 주 요약일 때만)
    const dayOfWeekStats: Record<string, { total: number; completed: number }> = {};
    if (period === "week") {
      todos.forEach((todo) => {
        if (todo.due_date) {
          const dueDate = new Date(todo.due_date);
          const dayName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][dueDate.getDay()];
          if (!dayOfWeekStats[dayName]) {
            dayOfWeekStats[dayName] = { total: 0, completed: 0 };
          }
          dayOfWeekStats[dayName].total++;
          if (todo.completed) {
            dayOfWeekStats[dayName].completed++;
          }
        }
      });
    }

    // 완료하기 쉬운 작업 패턴 분석 (완료된 작업)
    const completedTodos = todos.filter((t) => t.completed);
    const completedCategories = completedTodos.map((t) => t.category || "기타");
    const completedPriorities = completedTodos.map((t) => t.priority);
    const mostCompletedCategory = Object.entries(
      completedCategories.reduce((acc, cat) => {
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1])[0]?.[0] || "없음";

    // 미루는 작업 패턴 (지연된 작업, 높은 우선순위 미완료)
    const delayedTodos = todos.filter((t) => !t.completed && t.due_date && new Date(t.due_date) < now);
    const delayedCategories = delayedTodos.map((t) => t.category || "기타");
    const mostDelayedCategory = Object.entries(
      delayedCategories.reduce((acc, cat) => {
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1])[0]?.[0] || "없음";

    // 긴급 작업 목록
    const urgentTasks = todos
      .filter((t) => {
        if (t.completed) return false;
        if (t.priority === "high") return true;
        if (t.due_date) {
          const dueDate = new Date(t.due_date);
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntilDue <= 1;
        }
        return false;
      })
      .map((t) => t.title)
      .slice(0, 5);

    const prompt = `당신은 할 일 관리 전문가입니다. 다음은 ${period === "today" ? "오늘" : "이번 주"} 사용자의 할 일 데이터입니다.

=== 현재 상황 ===
현재 날짜: ${currentYear}년 ${currentMonth}월 ${currentDay}일
분석 기간: ${period === "today" ? "오늘 하루" : "이번 주 (월~일)"}

=== 기본 통계 ===
- 전체 할 일: ${totalCount}개
- 완료된 할 일: ${completedCount}개
- 미완료 할 일: ${totalCount - completedCount}개
- 전체 완료율: ${completionRate}%
- 미완료 긴급 작업: ${highPriorityCount}개
- 지연된 작업: ${overdueCount}개
- 마감일 준수율: ${onTimeRate}%

=== 우선순위별 완료율 분석 ===
- 높음: ${priorityStats.high.completed}/${priorityStats.high.total}개 완료 (${priorityStats.high.rate}%)
- 중간: ${priorityStats.medium.completed}/${priorityStats.medium.total}개 완료 (${priorityStats.medium.rate}%)
- 낮음: ${priorityStats.low.completed}/${priorityStats.low.total}개 완료 (${priorityStats.low.rate}%)

=== 카테고리별 통계 ===
${Object.entries(categoryStats)
  .map(([cat, stat]) => `- ${cat}: ${stat.completed}/${stat.total}개 완료 (${stat.rate}%)`)
  .join("\n")}

=== 시간대별 업무 집중도 (미완료 작업 기준) ===
${Object.entries(timeSlots)
  .map(([slot, count]) => `- ${slot} (${slot === "아침" ? "6-9시" : slot === "오전" ? "9-12시" : slot === "오후" ? "12-18시" : slot === "저녁" ? "18-22시" : "22시 이후"}): ${count}개`)
  .join("\n")}${period === "week" && Object.keys(dayOfWeekStats).length > 0 ? `\n\n=== 요일별 분석 ===
${Object.entries(dayOfWeekStats)
  .map(([day, stat]) => `- ${day}: ${stat.completed}/${stat.total}개 완료`)
  .join("\n")}` : ""}

=== 생산성 패턴 분석 ===
- 가장 많이 완료한 카테고리: ${mostCompletedCategory}
- 자주 미루는 카테고리: ${mostDelayedCategory}${mostDelayedCategory !== "없음" ? " (지연된 작업 기준)" : ""}

=== 긴급 작업 목록 ===
${urgentTasks.length > 0 ? urgentTasks.map((task, i) => `${i + 1}. ${task}`).join("\n") : "없음"}

=== 상세 할 일 목록 ===
${todos
  .map(
    (todo, idx) => {
      const dueInfo = todo.due_date 
        ? `, 마감: ${new Date(todo.due_date).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}`
        : "";
      const createdInfo = todo.created_date 
        ? `, 생성: ${new Date(todo.created_date).toLocaleString("ko-KR", { month: "long", day: "numeric" })}`
        : "";
      return `${idx + 1}. [${todo.completed ? "✓ 완료" : "○ 미완료"}] "${todo.title}" (우선순위: ${todo.priority === "high" ? "높음" : todo.priority === "medium" ? "중간" : "낮음"}, 카테고리: ${todo.category || "기타"}${dueInfo}${createdInfo})`;
    }
  )
  .join("\n")}

=== 분석 요청 사항 ===

위 데이터를 심층 분석하여 다음 JSON 형식으로 응답해주세요:

{
  "summary": "전체 요약 문장 (완료율, 주요 성과 포함, ${period === "today" ? "오늘의 집중도와 남은 할 일" : "이번 주 패턴"})",
  "urgentTasks": ["긴급 작업 제목 1", "긴급 작업 제목 2"],
  "insights": [
    "인사이트 1 (구체적이고 실행 가능한 분석)",
    "인사이트 2",
    "인사이트 3 (최대 5개)"
  ],
  "recommendations": [
    "추천 1 (구체적이고 실행 가능한 조언)",
    "추천 2 (최대 5개)"
  ]
}

=== 분석 가이드라인 ===

1. 완료율 분석:
   - 우선순위별 완료 패턴을 분석 (높은 우선순위를 잘 처리하는지, 낮은 우선순위에 집중하는지)
   - 카테고리별 완료 패턴 분석 (어떤 분야에서 생산성이 높은지)
   ${period === "week" ? "- 요일별 패턴을 분석하여 가장 생산적인 요일 도출" : "- 오늘의 집중도와 효율성 분석"}

2. 시간 관리 분석:
   - 마감일 준수율(${onTimeRate}%)을 기반으로 시간 관리 능력 평가
   - 시간대별 업무 집중도 분석 (어느 시간대에 할 일이 집중되어 있는지)
   - 지연된 작업(${overdueCount}개)의 패턴 분석
   - 연기되는 작업의 공통 특징 파악

3. 생산성 패턴:
   - 가장 많이 완료한 카테고리(${mostCompletedCategory})의 특징 분석
   - 자주 미루는 카테고리(${mostDelayedCategory !== "없음" ? mostDelayedCategory : "없음"})의 원인 추론
   ${period === "week" ? "- 요일별 패턴에서 가장 생산적인 요일과 시간대 도출" : "- 시간대별 집중도에서 가장 효율적인 시간대 분석"}
   - 완료하기 쉬운 작업과 미루기 쉬운 작업의 차이점 분석

4. 실행 가능한 추천:
   - 구체적인 시간 관리 팁 제공 (예: "오후 시간대 할 일을 오전으로 2개씩 분산하기")
   - 우선순위 조정 제안 (데이터 기반)
   - 업무 과부하를 줄이는 분산 전략 (시간대별, 요일별 분산)
   - 즉시 실행 가능한 액션 아이템

5. 긍정적인 피드백:
   - 잘하고 있는 부분을 구체적으로 강조 (예: "높은 우선순위 작업을 ${priorityStats.high.rate}% 완료하셨어요!")
   - 개선점을 격려하는 긍정적인 톤으로 제시
   - 동기부여가 되는 메시지 포함

6. 기간별 차별화:
   ${period === "today" 
     ? "- 오늘의 요약: 당일 집중도 분석, 남은 시간 활용 방안, 긴급 작업 우선순위 제시"
     : "- 이번 주 요약: 주간 패턴 분석, 가장 생산적인 요일/시간대, 다음 주 계획 제안, 주간 완료율 평가"}

7. 문체:
   - 자연스럽고 친근한 한국어
   - 구체적인 수치와 데이터를 포함
   - 이해하기 쉽고 바로 실천할 수 있는 문장
   - 격려와 동기부여가 담긴 톤

=== 중요 규칙 ===
- 반드시 유효한 JSON 형식만 응답 (마크다운 코드 블록 없이 순수 JSON)
- 모든 필수 필드 포함 (summary, urgentTasks, insights, recommendations)
- insights와 recommendations는 각각 3-5개로 구성
- 긍정적이면서도 구체적인 피드백 제공
- 데이터 기반의 정확한 분석

JSON만 응답하세요.`;

    let responseText: string;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that analyzes todo data and provides insights in Korean. Always respond with valid JSON only, no markdown or explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
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
          { error: "AI 서비스 사용 한도가 초과되었습니다. 잠시 후 다시 시도해주세요." },
          { status: 429 }
        );
      }

      // AI 처리 실패 (400)
      if (aiError.status === 400 || aiError.message?.includes("400")) {
        return NextResponse.json(
          { error: `AI 분석 중 오류가 발생했습니다: ${aiError.message || "알 수 없는 오류"}` },
          { status: 400 }
        );
      }

      // 기타 AI 오류
      return NextResponse.json(
        { error: `AI 처리 중 오류가 발생했습니다: ${aiError.message || "알 수 없는 오류"}` },
        { status: 500 }
      );
    }

    // JSON 추출
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
      
      if (!parsedData.summary) {
        throw new Error("AI 응답에 summary 필드가 없습니다.");
      }
    } catch (parseError: any) {
      console.error("JSON 파싱 오류:", parseError);
      console.error("응답 텍스트:", responseText);
      
      // 파싱 실패 시 기본 응답
      return NextResponse.json(
        {
          summary: `총 ${totalCount}개의 할 일 중 ${completedCount}개 완료(${completionRate}%)`,
          urgentTasks: urgentTasks,
          insights: [
            period === "today" 
              ? "오늘 할 일을 확인하고 우선순위에 따라 정리하세요."
              : "이번 주 할 일 분포를 확인하고 계획을 세워보세요.",
            highPriorityCount > 0 
              ? `긴급 작업 ${highPriorityCount}개가 완료를 기다리고 있습니다.`
              : "우선순위가 높은 작업이 없습니다.",
          ],
          recommendations: [
            urgentTasks.length > 0 
              ? "긴급한 작업부터 우선 처리하세요."
              : "여유 시간을 활용해 미완료 작업을 정리하세요.",
            "완료된 할 일을 체크하고 다음 단계를 계획하세요.",
          ],
        },
        { status: 200 }
      );
    }

    // 응답 검증 및 기본값 설정
    const validatedResponse = {
      summary: String(parsedData.summary || `총 ${totalCount}개의 할 일 중 ${completedCount}개 완료(${completionRate}%)`),
      urgentTasks: Array.isArray(parsedData.urgentTasks) 
        ? parsedData.urgentTasks.slice(0, 5).map(String)
        : urgentTasks,
      insights: Array.isArray(parsedData.insights)
        ? parsedData.insights.slice(0, 5).map(String)
        : ["할 일 분석을 완료했습니다."],
      recommendations: Array.isArray(parsedData.recommendations)
        ? parsedData.recommendations.slice(0, 5).map(String)
        : ["할 일을 관리하고 진행 상황을 확인하세요."],
    };

    return NextResponse.json(validatedResponse);
  } catch (error: any) {
    console.error("AI 요약 생성 오류:", error);

    // API 호출 한도 초과
    if (
      error.status === 429 ||
      error.message?.includes("429") ||
      error.message?.includes("quota") ||
      error.message?.includes("rate limit")
    ) {
      return NextResponse.json(
        { error: "AI 서비스 사용 한도가 초과되었습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    // AI 처리 실패
    if (error.status === 400 || error.message?.includes("400")) {
      return NextResponse.json(
        { error: "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "요약 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
