"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Mail, Calendar, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

export default function ProfilePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    createdAt: "",
  });
  const [activityStats, setActivityStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    completionRate: 0,
  });

  useEffect(() => {
    const loadUserInfo = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // 사용자 정보 로드
      const { data: userData, error } = await supabase
        .from("users")
        .select("email, name, created_at")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error loading user:", error);
        // 기본값 설정
        setUserInfo({
          name: session.user.user_metadata?.name || "",
          email: session.user.email || "",
          createdAt: new Date(session.user.created_at || "").toLocaleDateString("ko-KR"),
        });
      } else {
        setUserInfo({
          name: userData?.name || "",
          email: userData?.email || session.user.email || "",
          createdAt: userData?.created_at
            ? new Date(userData.created_at).toLocaleDateString("ko-KR")
            : new Date().toLocaleDateString("ko-KR"),
        });
      }

      // 활동 통계 로드
      const { data: todosData, error: todosError } = await supabase
        .from("todos")
        .select("completed, due_date")
        .eq("user_id", session.user.id);

      if (!todosError && todosData) {
        const total = todosData.length;
        const completed = todosData.filter((t) => t.completed).length;
        const now = new Date();
        const inProgress = todosData.filter(
          (t) => !t.completed && t.due_date && new Date(t.due_date) >= now
        ).length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        setActivityStats({
          total,
          completed,
          inProgress,
          completionRate,
        });
      }

      setIsLoading(false);
    };

    loadUserInfo();
  }, [router]);

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

  const handleSave = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ name: userInfo.name })
      .eq("id", session.user.id);

    if (error) {
      console.error("Error updating user:", error);
      addToast({
        type: "error",
        title: "업데이트 실패",
        description: "사용자 정보 업데이트에 실패했습니다. 다시 시도해주세요.",
      });
      return;
    }

    setIsEditing(false);
    addToast({
      type: "success",
      title: "업데이트 완료",
      description: "사용자 정보가 성공적으로 업데이트되었습니다.",
    });
  };

  if (isLoading) {
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
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">마이페이지</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 사용자 정보 카드 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>사용자 정보</CardTitle>
                  <CardDescription>계정 정보를 확인하고 수정할 수 있습니다</CardDescription>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <User className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={userInfo.name}
                    onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                  />
                ) : (
                  <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm">
                    {userInfo.name}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex h-10 flex-1 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {userInfo.email}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  이메일은 변경할 수 없습니다
                </p>
              </div>

              <div className="space-y-2">
                <Label>가입일</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {userInfo.createdAt}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} className="flex-1">
                      저장
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="flex-1"
                    >
                      취소
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)} className="flex-1">
                    정보 수정
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 통계 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>활동 통계</CardTitle>
              <CardDescription>나의 할 일 관리 활동을 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{activityStats.total}</div>
                  <div className="text-sm text-muted-foreground">전체 할 일</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{activityStats.completed}</div>
                  <div className="text-sm text-muted-foreground">완료한 할 일</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{activityStats.inProgress}</div>
                  <div className="text-sm text-muted-foreground">진행 중</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{activityStats.completionRate}%</div>
                  <div className="text-sm text-muted-foreground">완료율</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 설정 카드 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>설정</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

