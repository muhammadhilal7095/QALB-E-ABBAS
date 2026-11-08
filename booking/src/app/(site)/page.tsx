import { redirect } from "next/navigation";
import { env } from "@/lib/env";

/** This app only handles payments — send visitors to the booking form on the website. */
export default function Home() {
  redirect(`${env.mainSiteUrl()}/book-consultation`);
}
