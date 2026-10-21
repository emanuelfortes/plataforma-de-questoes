import type { Metadata } from "next";
import Link from "next/link";
import { ContatoWhatsapp, PaginaLegal, Responsavel } from "@/components/pagina-legal";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

// Texto fiel ao que o sistema faz. Mudou o que é coletado ou com quem é compartilhado? Atualize aqui.
export default function PaginaPrivacidade() {
  return (
    <PaginaLegal titulo="Política de privacidade">
      <p>
        Esta política explica quais dados pessoais a plataforma {LEGAL.site} coleta, para que usa, com quem
        compartilha e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018,
        LGPD).
      </p>

      <h2>1. Quem é o responsável</h2>
      <p>
        O responsável pelo tratamento dos seus dados (controlador) é <Responsavel />. Dúvidas e pedidos sobre seus
        dados: <ContatoWhatsapp mensagem="Olá! Tenho um pedido sobre meus dados na plataforma Riccardo Nóbrega." />.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li>
          <strong>Cadastro:</strong> nome, e-mail e senha. A senha é guardada de forma criptografada (nem nós
          conseguimos lê-la).
        </li>
        <li>
          <strong>Estudo:</strong> as questões que você responde, a alternativa escolhida, se acertou ou errou, a data
          e hora, e o andamento das revisões de flashcards.
        </li>
        <li>
          <strong>Acesso e segurança:</strong> endereço IP e tipo de navegador ou aparelho de cada sessão aberta, e o
          IP usado para limitar tentativas de login.
        </li>
      </ul>
      <ul>
        <li>
          <strong>Assinatura:</strong> se você assinar, guardamos a situação da assinatura (ativa ou cancelada), o
          valor, as datas e o resultado de cada cobrança. Os dados do cartão são digitados direto no Mercado Pago:
          nunca passam por nós.
        </li>
      </ul>
      <p>Não coletamos documentos, endereço, telefone, números de cartão nem dados sensíveis.</p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta e permitir o login.</li>
        <li>Mostrar seu progresso, seus acertos e erros e o seu desempenho por período e por matéria.</li>
        <li>Programar as revisões dos flashcards (repetição espaçada).</li>
        <li>
          Proteger sua conta: limitar tentativas de senha, permitir que você desconecte outros aparelhos e
          investigar abusos.
        </li>
        <li>Enviar e-mails do serviço, como confirmação de e-mail e recuperação de senha.</li>
        <li>Cobrar a assinatura, liberar o acesso de quem paga e cumprir obrigações fiscais.</li>
      </ul>
      <p>Não vendemos seus dados, não exibimos publicidade e não usamos cookies de rastreamento ou de anúncios.</p>

      <h2>4. Base legal</h2>
      <p>
        Tratamos os dados para executar o serviço que você contratou ao criar a conta (art. 7º, V, da LGPD) e, no
        caso das medidas de segurança, pelo legítimo interesse de proteger você e a plataforma (art. 7º, IX).
      </p>

      <h2>5. Cookies</h2>
      <p>
        Usamos apenas um cookie essencial, que mantém você conectado. Sem ele não é possível usar a plataforma, por
        isso não pedimos consentimento separado. Não há cookies de terceiros.
      </p>

      <h2>6. Com quem compartilhamos</h2>
      <p>Só com empresas que operam a plataforma para nós, e apenas no necessário:</p>
      <ul>
        <li>
          <strong>Vercel Inc.:</strong> hospedagem do site. Pode processar dados em servidores fora do Brasil, com as
          garantias exigidas pelo art. 33 da LGPD.
        </li>
        <li>
          <strong>Turso:</strong> banco de dados onde ficam sua conta e seu histórico, em servidores em São Paulo.
        </li>
        <li>
          <strong>Mercado Pago:</strong> processa o pagamento da assinatura. Recebe seu e-mail e os dados do cartão
          que você informar na página dele.
        </li>
        <li>
          <strong>Serviço de envio de e-mail:</strong> recebe apenas seu nome e e-mail para entregar as mensagens do
          serviço.
        </li>
      </ul>
      <p>Também podemos fornecer dados quando a lei ou uma ordem judicial exigir.</p>

      <h2>7. Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir. Quando você exclui a conta, apagamos na hora seu cadastro, sessões, respostas,
        desempenho e revisões de flashcards. O registro das cobranças (valor, data e situação) é mantido pelo prazo
        exigido pela lei fiscal (art. 16, I, da LGPD), sem ficar ligado ao seu perfil de estudo. Cópias de
        segurança do provedor podem manter os dados por um prazo curto até serem substituídas.
      </p>

      <h2>8. Seus direitos</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>
          <strong>Ver e baixar seus dados:</strong> em <Link href="/conta">Minha conta</Link>, botão &quot;Baixar meus
          dados&quot;.
        </li>
        <li>
          <strong>Corrigir seu nome:</strong> em <Link href="/conta">Minha conta</Link>.
        </li>
        <li>
          <strong>Excluir sua conta e todo o histórico:</strong> em <Link href="/conta">Minha conta</Link>,
          &quot;Excluir conta&quot;.
        </li>
        <li>
          Pedir informações, correções ou qualquer outro direito do art. 18 da LGPD pelo{" "}
          <ContatoWhatsapp mensagem="Olá! Tenho um pedido sobre meus dados na plataforma Riccardo Nóbrega." />. Respondemos em até
          15 dias.
        </li>
        <li>Reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>

      <h2>9. Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), senhas criptografadas, limite de tentativas de login e acesso restrito
        ao banco de dados. Nenhum sistema é totalmente imune a falhas; se houver um incidente que possa trazer risco
        a você, avisaremos você e a ANPD.
      </p>

      <h2>10. Menores de idade</h2>
      <p>
        A plataforma é voltada a quem estuda para concursos. Menores de 18 anos só devem usá-la com autorização e
        acompanhamento dos pais ou responsáveis.
      </p>

      <h2>11. Mudanças nesta política</h2>
      <p>
        Podemos atualizar esta política. A data no topo mostra a última versão; mudanças importantes serão avisadas
        na plataforma.
      </p>
    </PaginaLegal>
  );
}
