import { redirect } from "next/navigation";

export default function UnlockPage() {
  redirect("/auth/sign-in");
}
