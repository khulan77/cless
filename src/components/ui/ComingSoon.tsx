import { PillLink } from "./Button";
import { Container } from "./Container";

/** Хараахан хийгдээгүй хуудсанд 404-ийн оронд */
export function ComingSoon({ title, text, back = { label: "Нүүр хуудас руу", href: "/" } }: {
  title: string;
  text?: string;
  back?: { label: string; href: string };
}) {
  return (
    <Container as="section" className="flex min-h-[55vh] flex-col items-center justify-center py-24 text-center">
      <p className="text-micro text-muted">Удахгүй</p>
      <h1 className="text-section mt-3">{title}</h1>
      <p className="mt-4 max-w-[46ch] text-muted">{text ?? "Энэ хуудас удахгүй нээгдэнэ."}</p>
      <PillLink href={back.href} className="mt-8">
        {back.label}
      </PillLink>
    </Container>
  );
}
