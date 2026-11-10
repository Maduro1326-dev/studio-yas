
import Link from "next/link";
import { FaInstagram, FaFacebookF } from "react-icons/fa";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">

      <section className="studio-card text-center">

        {/* Identidade da marca */}
        <header className="mb-12">

          <p className="mb-4 text-xs tracking-[0.6em] text-[#673016]">
            STUDIO
          </p>

          <h1
            translate="no"
            className="font-serif text-7xl font-light tracking-[0.12em] text-[#673016]"
          >
            YΛS
          </h1>

          <p className="mt-6 text-sm tracking-wide text-[#673016]">
            A beleza mora nos detalhes.
          </p>

        </header>

        {/* Links principais */}
        <nav
          aria-label="Links do Studio Yas"
          className="flex flex-col gap-4"
        >

          <a
            href="https://wa.me/5512992126289"
            target="_blank"
            rel="noopener noreferrer"
            className="studio-button"
          >
            Fale pelo WhatsApp
          </a>

          <a
            href="https://wa.me/5547999999999?text=Ola%21%20Gostaria%20de%20agendar%20um%20horario."
            target="_blank"
            rel="noopener noreferrer"
            className="studio-button"
          >
            Agendar meu horário
          </a>

          <Link
            href="/portfolio"
            className="studio-button"
          >
            Conhecer o portfólio
          </Link>

        </nav>

        {/* Rodapé */}
        
<footer className="mt-12">

  <div className="mx-auto mb-5 h-px w-16 bg-[#673016]/30" />

  <p className="text-[11px] tracking-[0.2em] text-[#673016]">
    BRUSQUE • SANTA CATARINA
  </p>

  
<div className="social-links">
  <a
    href="https://www.instagram.com/studioyas.br/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Instagram do Studio Yas"
    className="social-icon"
  >
    <FaInstagram size={23} />
  </a>

  <a
    href="https://www.facebook.com/yasmin.parga.9"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Facebook do Studio Yas"
    className="social-icon"
  >
    <FaFacebookF size={23} />
  </a>
</div>

  <p className="mt-5 text-[10px] tracking-wider text-[#673016]/70">
    NAIL DESIGNER
  </p>

</footer>


      </section>

    </main>
  );
}
