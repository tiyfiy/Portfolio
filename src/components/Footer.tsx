import { profile } from "@/lib/data";

export default function Footer() {
  return (
    <footer className="footer">
      <p>© {new Date().getFullYear()} {profile.name}</p>
    </footer>
  );
}
