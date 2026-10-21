import type { Metadata } from "next";
import Link from "next/link";
import { ContatoWhatsapp, PaginaLegal, Responsavel } from "@/components/pagina-legal";
import { LEGAL } from "@/lib/legal";
import { ASSINATURA, formatarReais, LIMITE_GRATIS_DIA } from "@/lib/planos";

export const metadata: Metadata = { title: "Termos de uso" };

export default function PaginaTermos() {
  return (
    <PaginaLegal titulo="Termos de uso">
      <p>
        Estes termos valem para o uso da plataforma {LEGAL.site}, mantida por <Responsavel />. Ao criar uma conta,
        você concorda com eles e com a <Link href="/privacidade">Política de privacidade</Link>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        A plataforma oferece questões de múltipla escolha e de certo ou errado, flashcards com revisão espaçada e
        acompanhamento de desempenho, para quem estuda para concursos.
      </p>

      <h2>2. Sua conta</h2>
      <ul>
        <li>Use dados verdadeiros e um e-mail que seja seu.</li>
        <li>A conta é pessoal: não compartilhe sua senha nem empreste o acesso.</li>
        <li>Você é responsável pelo que for feito com a sua conta. Se suspeitar de uso indevido, troque a senha.</li>
      </ul>

      <h2>3. O que não é permitido</h2>
      <ul>
        <li>Copiar, baixar em massa, revender ou publicar as questões e flashcards da plataforma.</li>
        <li>Usar robôs, programas ou qualquer meio automático para acessar ou extrair o conteúdo.</li>
        <li>Tentar burlar a segurança, acessar contas de outras pessoas ou atrapalhar o funcionamento do site.</li>
      </ul>
      <p>Quem descumprir estas regras pode ter a conta suspensa ou excluída.</p>

      <h2>4. Sobre o conteúdo</h2>
      <ul>
        <li>
          As questões são inéditas, elaboradas a partir de material de estudo com o apoio de ferramentas de
          inteligência artificial. Não são questões de provas reais, salvo quando indicado.
        </li>
        <li>
          Trabalhamos para que gabaritos e comentários estejam corretos, mas pode haver erros. Encontrou um? Avise
          pelo <ContatoWhatsapp mensagem="Olá! Encontrei um erro numa questão da plataforma Riccardo Nóbrega." />.
        </li>
        <li>
          A plataforma é um apoio ao estudo: não substitui o edital nem a legislação oficial e não garante aprovação
          em concurso.
        </li>
        <li>O conteúdo pertence a {LEGAL.responsavel} e é protegido pela lei de direitos autorais.</li>
      </ul>

      <h2>5. Disponibilidade e mudanças</h2>
      <p>
        Buscamos manter a plataforma no ar, mas ela pode ficar indisponível para manutenção ou por falhas de
        terceiros. Podemos adicionar, mudar ou remover funcionalidades e conteúdos.
      </p>

      <h2>6. Planos e pagamento</h2>
      <ul>
        <li>
          <strong>Plano grátis:</strong> até {LIMITE_GRATIS_DIA} questões por dia.
        </li>
        <li>
          <strong>{ASSINATURA.nome}:</strong> {formatarReais(ASSINATURA.valor)} por mês, com questões ilimitadas.
        </li>
        <li>
          O pagamento é processado pelo Mercado Pago, no cartão de crédito, e <strong>renova sozinho todo mês</strong>{" "}
          até você cancelar. Não recebemos nem guardamos os dados do seu cartão.
        </li>
        <li>
          <strong>Cancelamento:</strong> a qualquer momento, em <Link href="/assinatura">Assinatura</Link>, sem multa.
          Você continua com acesso até o fim do mês já pago e não há novas cobranças.
        </li>
        <li>
          <strong>Direito de arrependimento:</strong> você pode desistir em até 7 dias após a primeira contratação
          (art. 49 do Código de Defesa do Consumidor) e recebe o valor de volta. Peça pelo <ContatoWhatsapp />.
        </li>
        <li>Se o preço mudar, avisaremos antes; a mudança só vale para as cobranças seguintes ao aviso.</li>
        <li>
          Se uma cobrança for recusada, o Mercado Pago tenta de novo nos dias seguintes; sem pagamento, o acesso
          volta ao plano grátis.
        </li>
      </ul>

      <h2>7. Encerramento</h2>
      <p>
        Você pode excluir sua conta quando quiser, em <Link href="/conta">Minha conta</Link>. Seus dados são apagados
        como descrito na <Link href="/privacidade">Política de privacidade</Link>.
      </p>

      <h2>8. Responsabilidade</h2>
      <p>
        Não respondemos por resultados em provas ou concursos, por decisões tomadas com base no conteúdo, nem por
        falhas causadas por terceiros ou pelo seu aparelho ou conexão, nos limites permitidos pela lei.
      </p>

      <h2>9. Alterações destes termos</h2>
      <p>
        Podemos atualizar estes termos. A data no topo mostra a última versão; mudanças importantes serão avisadas na
        plataforma. Continuar usando depois do aviso significa que você concorda com a nova versão.
      </p>

      <h2>10. Lei e foro</h2>
      <p>
        Estes termos seguem as leis do Brasil.{" "}
        {LEGAL.foro
          ? `Fica eleito o foro de ${LEGAL.foro}, ressalvado o seu direito de ajuizar ação no foro do seu domicílio, como consumidor.`
          : "Eventuais disputas serão resolvidas no foro do domicílio do usuário, como garante o Código de Defesa do Consumidor."}
      </p>
      <p>
        Dúvidas: <ContatoWhatsapp />.
      </p>
    </PaginaLegal>
  );
}
