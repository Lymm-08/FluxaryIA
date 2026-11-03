import { CollectionCard, CollectionPage } from "../components/CollectionPage";
import { BankLogo } from "../components/BankLogo";
import type { CreditCardItem, CustomBank, Transaction } from "../types/finance";
import { getCardUsage } from "../utils/finance";
import { money } from "../utils/format";

// Cartões com limite, compras pendentes e progresso da fatura.
export function CardsPage({ cards, customBanks, transactions, onAdd, onEdit, onDelete, onPayCard }: {
  cards: CreditCardItem[];
  customBanks: CustomBank[];
  transactions: Transaction[];
  onAdd: () => void;
  onEdit: (card: CreditCardItem) => void;
  onDelete: (card: CreditCardItem) => void;
  onPayCard: (card: CreditCardItem) => void;
}) {
  return (
    <CollectionPage eyebrow="FLUXARY.IA · CRÉDITO" title="Cartões" description="Acompanhe o limite disponível e os gastos registrados no crédito." action={onAdd} empty={cards.length === 0}>
      {cards.map((card, index) => {
        const usage = getCardUsage(card, transactions);
        return (
          <CollectionCard
            key={card.id}
            icon={<BankLogo bankId={card.bankId} customBanks={customBanks} />}
            title={`${card.issuer}${cards.filter((item) => item.issuer === card.issuer).length > 1 ? ` · ${index + 1}` : ""}`}
            subtitle={`${money.format(usage.used)} usados · ${usage.available < 0 ? `${money.format(Math.abs(usage.available))} acima do limite` : `${money.format(usage.available)} disponíveis`}`}
            value={`Limite ${money.format(card.creditLimit)}`}
            progress={usage.progress}
            progressLabel={`${money.format(usage.used)} utilizados`}
            onEdit={() => onEdit(card)}
            onDelete={() => onDelete(card)}
            action={<button className="button-soft card-payment-button" type="button" disabled={usage.used <= 0} onClick={() => onPayCard(card)}>Pagar fatura</button>}
          />
        );
      })}
    </CollectionPage>
  );
}
