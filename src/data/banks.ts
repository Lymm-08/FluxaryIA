// Instituições públicas: logos servidos pelo favicon oficial de cada domínio.
export const BANK_OPTIONS = [
  { id: "nubank", name: "Nubank", domain: "nubank.com.br" },
  { id: "itau", name: "Itaú", domain: "itau.com.br" },
  { id: "banco-do-brasil", name: "Banco do Brasil", domain: "bb.com.br" },
  { id: "bradesco", name: "Bradesco", domain: "bradesco.com.br" },
  { id: "santander", name: "Santander", domain: "santander.com.br" },
  { id: "caixa", name: "Caixa", domain: "caixa.gov.br" },
  { id: "inter", name: "Inter", domain: "inter.co" },
  { id: "c6-bank", name: "C6 Bank", domain: "c6bank.com.br" },
  { id: "btg-pactual", name: "BTG Pactual", domain: "btgpactual.com" },
  { id: "safra", name: "Safra", domain: "safra.com.br" },
  { id: "sicoob", name: "Sicoob", domain: "sicoob.com.br" },
  { id: "sicredi", name: "Sicredi", domain: "sicredi.com.br" },
  { id: "banrisul", name: "Banrisul", domain: "banrisul.com.br" },
  { id: "banco-pan", name: "Banco PAN", domain: "bancopan.com.br" },
  { id: "pagbank", name: "PagBank", domain: "pagbank.com.br" },
  { id: "mercado-pago", name: "Mercado Pago", domain: "mercadopago.com.br" },
  { id: "picpay", name: "PicPay", domain: "picpay.com" },
  { id: "neon", name: "Neon", domain: "neon.com.br" },
  { id: "next", name: "Next", domain: "next.me" },
  { id: "banco-bv", name: "Banco BV", domain: "bv.com.br" },
  { id: "bmg", name: "Banco Bmg", domain: "bancobmg.com.br" },
  { id: "agibank", name: "Agibank", domain: "agibank.com.br" },
  { id: "banco-do-nordeste", name: "Banco do Nordeste", domain: "bnb.gov.br" },
  { id: "stone", name: "Stone", domain: "stone.com.br" },
  { id: "infinitepay", name: "InfinitePay", domain: "infinitepay.io" },
  { id: "cora", name: "Cora", domain: "cora.com.br" },
  { id: "sofisa-direto", name: "Sofisa Direto", domain: "sofisadireto.com.br" },
  { id: "brb", name: "BRB", domain: "brb.com.br" },
  { id: "daycoval", name: "Daycoval", domain: "daycoval.com.br" },
  { id: "unicred", name: "Unicred", domain: "unicred.com.br" },
] as const;

export type BankId = (typeof BANK_OPTIONS)[number]["id"];

export function getBank(bankId: string | undefined) {
  return BANK_OPTIONS.find((bank) => bank.id === bankId);
}
