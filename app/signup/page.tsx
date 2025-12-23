"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sparkles, Mail, Lock, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validatePassword = (pwd: string) => {
    // 최소 6자 이상
    if (pwd.length < 6) {
      return "비밀번호는 최소 6자 이상이어야 합니다.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // 입력값 검증
    if (!email || !password || !confirmPassword) {
      setError("모든 필드를 입력해주세요.");
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    // 비밀번호 확인 검증
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    // 비밀번호 유효성 검사
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (signUpError) {
        // Supabase 에러 메시지 처리
        if (signUpError.message.includes("User already registered")) {
          setError("이미 등록된 이메일입니다. 로그인해주세요.");
        } else if (signUpError.message.includes("Password")) {
          setError("비밀번호는 최소 6자 이상이어야 합니다.");
        } else {
          setError(signUpError.message || "회원가입에 실패했습니다. 다시 시도해주세요.");
        }
        return;
      }

      if (data.user) {
        // 이메일 인증이 필요한 경우
        if (data.user.email_confirmed_at === null) {
          setSuccess(true);
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        } else {
          // 이메일 인증이 필요 없는 경우 바로 로그인
          router.push("/");
          router.refresh();
        }
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "회원가입 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* 1. 서비스 로고 / 소개 */}
        <section className="text-center space-y-4">
          {/* 로고 */}
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          {/* 서비스 설명 */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">할 일 관리</h1>
            <p className="text-muted-foreground">
              AI를 활용해 할 일을 빠르게 입력하고, 체계적으로 관리하세요
            </p>
          </div>
          
          {/* 핵심 가치 */}
          <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI 자연어 처리
            </span>
            <span>•</span>
            <span>명확한 관리</span>
            <span>•</span>
            <span>인사이트 제공</span>
          </div>
        </section>

        {/* 2. 회원가입 입력 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>회원가입</CardTitle>
            <CardDescription>
              이메일과 비밀번호를 입력하여 계정을 만드세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 text-center py-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">회원가입 완료!</h3>
                  <p className="text-sm text-muted-foreground">
                    로그인 페이지로 이동합니다...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* 이메일 입력창 */}
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* 비밀번호 입력창 */}
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="최소 6자 이상"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    비밀번호는 최소 6자 이상이어야 합니다.
                  </p>
                </div>

                {/* 비밀번호 확인 입력창 */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="비밀번호를 다시 입력하세요"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">
                      비밀번호가 일치하지 않습니다.
                    </p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      비밀번호가 일치합니다.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isLoading ||
                    !email ||
                    !password ||
                    !confirmPassword ||
                    password !== confirmPassword
                  }
                >
                  {isLoading ? "가입 중..." : "회원가입"}
                </Button>
              </form>
            )}

            {/* 3. 로그인 이동 */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                로그인
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

