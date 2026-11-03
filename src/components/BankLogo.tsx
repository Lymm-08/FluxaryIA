import { useState } from "react";
import { BANK_OPTIONS, getBank } from "../data/banks";
import type { CustomBank } from "../types/finance";
import { CATEGORY_COLORS } from "../data/categories";

const BANK_EMOJIS = ["🏦", "🏛️", "💳", "💰", "💸", "🏧", "💵", "📱"];

// Logo é obtido a partir do favicon público do site do banco; as iniciais são fallback.
export function BankLogo({ bankId, customBanks = [], size = 34 }: { bankId?: string; customBanks?: CustomBank[]; size?: number }) {
  const bank = getBank(bankId);
  const customBank = customBanks.find((item) => item.id === bankId);
  const [unavailable, setUnavailable] = useState(false);
  if (customBank) {
    return <span className="custom-bank-logo" style={{ width: size, height: size, backgroundColor: `${customBank.color}20`, color: customBank.color }}>{customBank.emoji}</span>;
  }
  if (!bank || unavailable) return <span className="bank-logo-fallback" style={{ width: size, height: size }}>{getInitials(bank?.name ?? "Banco")}</span>;
  const logoUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${bank.domain}`)}&sz=128`;
  return <img className="bank-logo-image" style={{ width: size, height: size }} src={logoUrl} alt={`Logo ${bank.name}`} loading="lazy" onError={() => setUnavailable(true)} />;
}

// Seleção pesquisável dos 30 bancos cadastrados no Fluxary.ia.
export function BankPicker({ initialBankId, initialBankName, fieldName = "institution", customBanks = [], onCreateCustomBank }: {
  initialBankId?: string;
  initialBankName?: string;
  fieldName?: "institution" | "issuer";
  customBanks?: CustomBank[];
  onCreateCustomBank: (bank: CustomBank) => void;
}) {
  const initialBank = getBank(initialBankId) ?? BANK_OPTIONS.find((bank) => bank.name === initialBankName);
  const initialCustomBank = customBanks.find((bank) => bank.id === initialBankId);
  const [selectedId, setSelectedId] = useState<string>(initialBank?.id ?? initialCustomBank?.id ?? "");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(!initialBank && !initialCustomBank);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customError, setCustomError] = useState("");
  const [customName, setCustomName] = useState("");
  const [customEmoji, setCustomEmoji] = useState(BANK_EMOJIS[0]);
  const [customColor, setCustomColor] = useState(CATEGORY_COLORS[0]);
  const filtered = BANK_OPTIONS.filter((bank) => bank.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const filteredCustom = customBanks.filter((bank) => bank.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const selectedBank = getBank(selectedId);
  const selectedCustomBank = customBanks.find((bank) => bank.id === selectedId);

  function chooseBank(bankId: string) {
    setSelectedId(bankId);
    setExpanded(false);
    setShowCustomForm(false);
    setSearch("");
  }

  function saveCustomBank() {
    const name = customName.trim();
    const emoji = customEmoji;
    const color = customColor;
    if (!name || !emoji || !/^#[\da-f]{6}$/i.test(color)) {
      setCustomError("Preencha o nome, o ícone e a cor do banco.");
      return;
    }
    const duplicate = [...BANK_OPTIONS, ...customBanks].some((bank) => bank.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0);
    if (duplicate) {
      setCustomError("Este banco já está na lista. Pesquise pelo nome para selecioná-lo.");
      return;
    }
    const customBank: CustomBank = { id: `custom-${crypto.randomUUID()}`, name, emoji, color };
    onCreateCustomBank(customBank);
    chooseBank(customBank.id);
  }

  return (
    <div className="bank-picker">
      <button type="button" className="bank-picker-selected" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        {selectedBank || selectedCustomBank
          ? <><BankLogo bankId={selectedId} customBanks={customBanks} size={30} /><span>{selectedBank?.name ?? selectedCustomBank?.name}</span></>
          : <span>Escolha seu banco</span>}
        <span className="bank-picker-chevron">{expanded ? "−" : "+"}</span>
      </button>
      <input type="hidden" name="bankId" value={selectedId} />
      <input type="hidden" name={fieldName} value={selectedBank?.name ?? selectedCustomBank?.name ?? ""} />
      {expanded && (
        <div className="bank-picker-panel">
          <input className="bank-search" aria-label="Buscar banco" placeholder={`Buscar entre ${BANK_OPTIONS.length} bancos...`} value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="bank-options">
            {filtered.map((bank) => (
              <button type="button" key={bank.id} className={`bank-option ${selectedId === bank.id ? "selected" : ""}`} onClick={() => chooseBank(bank.id)}>
                <BankLogo bankId={bank.id} size={28} /><span>{bank.name}</span>
              </button>
            ))}
            {filteredCustom.map((bank) => (
              <button type="button" key={bank.id} className={`bank-option ${selectedId === bank.id ? "selected" : ""}`} onClick={() => chooseBank(bank.id)}>
                <BankLogo bankId={bank.id} customBanks={customBanks} size={28} /><span>{bank.name}</span>
              </button>
            ))}
            {filtered.length + filteredCustom.length === 0 && <p className="bank-no-results">Nenhum banco encontrado.</p>}
          </div>
          {showCustomForm ? (
            <div className="custom-bank-form">
              <strong>Adicionar meu banco</strong>
              <input name="custom-bank-name" required maxLength={40} placeholder="Nome do banco" aria-label="Nome do banco personalizado" value={customName} onChange={(event) => setCustomName(event.target.value)} />
              <span className="custom-bank-label">Ícone</span>
              <div className="bank-emoji-options">
                {BANK_EMOJIS.map((emoji) => <label key={emoji}><input type="radio" name="custom-bank-emoji" value={emoji} checked={customEmoji === emoji} onChange={() => setCustomEmoji(emoji)} /><span>{emoji}</span></label>)}
              </div>
              <span className="custom-bank-label">Cor</span>
              <div className="color-choices">
                {CATEGORY_COLORS.map((color) => <label key={color} className="color-choice"><input type="radio" name="custom-bank-color" value={color} checked={customColor === color} onChange={() => setCustomColor(color)} /><span style={{ backgroundColor: color }} /></label>)}
              </div>
              {customError && <p className="bank-custom-error" role="alert">{customError}</p>}
              <div className="custom-bank-actions">
                <button type="button" className="button-secondary" onClick={() => setShowCustomForm(false)}>Cancelar</button>
                <button type="button" className="button-primary" onClick={saveCustomBank}>Adicionar banco</button>
              </div>
            </div>
          ) : (
            <button type="button" className="custom-bank-trigger" onClick={() => setShowCustomForm(true)}>+ Meu banco não está na lista</button>
          )}
        </div>
      )}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
