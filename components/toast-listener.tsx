"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

const TOAST_PARAM = "toast";
const TOAST_TYPE_PARAM = "toastType";

export function ToastListener() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toastMessage = searchParams.get(TOAST_PARAM);
  const toastType = searchParams.get(TOAST_TYPE_PARAM);
  const normalizedType = useMemo<Toast["type"]>(() => {
    if (toastType === "error" || toastType === "info") {
      return toastType;
    }

    return "success";
  }, [toastType]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const id = Date.now();
    setToasts((current) => [...current, { id, message: toastMessage, type: normalizedType }]);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(TOAST_PARAM);
    nextParams.delete(TOAST_TYPE_PARAM);
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });

    const timeout = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [normalizedType, pathname, router, searchParams, toastMessage]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="toast-region">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type}`} key={toast.id} role="status">
          <span aria-hidden="true" className="material-symbols-outlined">
            {toast.type === "error" ? "error" : toast.type === "info" ? "info" : "check_circle"}
          </span>
          <p>{toast.message}</p>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            type="button"
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              close
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
