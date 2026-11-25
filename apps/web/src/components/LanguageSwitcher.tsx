import { LOCALES, localeInfo, type Locale } from "@ideaproxima/i18n/locales";
import { useRouter } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { useId, useState } from "react";
import { useSaveLocale, useSession } from "@/api/session";
import { writeLocalePreference } from "@/locales/preferences";
import { useMessage } from "@/locales/react";
import { activatePreparedLocale, activeLocale, prepareLocale } from "@/locales/runtime";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import styles from "./LanguageSwitcher.module.scss";

export function LanguageSwitcher({ settings = false }: { settings?: boolean }) {
  const t = useMessage();
  const { me } = useSession();
  const saveLocale = useSaveLocale();
  const router = useRouter();
  const group = useId();
  const current = localeInfo(activeLocale());
  const [selected, setSelected] = useState<Locale>(current.tag);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const apply = async () => {
    setPending(true);
    setFailed(false);
    try {
      const catalogue = await prepareLocale(selected);
      const applySelection = () => {
        writeLocalePreference(selected);
        const url = new URL(window.location.href);
        if (url.searchParams.has("hl")) {
          url.searchParams.set("hl", selected);
          router.history.replace(url.pathname + url.search + url.hash, router.history.location.state);
        }
        activatePreparedLocale(selected, catalogue);
      };
      if (me) await saveLocale(selected, applySelection);
      else applySelection();
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={settings ? styles.setting : undefined}>
      {settings && (
        <div>
          <strong>{t("locale.label")}</strong>
          <p>{t("locale.saveHint")}</p>
        </div>
      )}
      <Button
        variant={settings ? "secondary" : "ghost"}
        size="sm"
        className={settings ? styles.trigger : styles.headerTrigger}
        aria-haspopup="dialog"
        onClick={() => {
          setSelected(current.tag);
          setFailed(false);
          setOpen(true);
        }}
      >
        {!settings && <Globe aria-hidden />}
        <span className="visually-hidden">{t("locale.label")} </span>
        <bdi lang={current.tag}>{current.name}</bdi>
      </Button>
      <Dialog
        title={t("locale.label")}
        closeLabel={t("locale.close")}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <Button variant="primary" loading={pending} onClick={() => void apply()}>
            {t("locale.apply")}
          </Button>
        }
      >
        <fieldset className={styles.list} disabled={pending}>
          <legend>{t("locale.choose")}</legend>
          {LOCALES.map(({ tag, name, status }) => (
            <label key={tag}>
              <input
                type="radio"
                name={group}
                checked={selected === tag}
                onChange={() => setSelected(tag)}
                autoFocus={current.tag === tag}
              />
              <bdi lang={tag}>{name}</bdi>
              {status === "beta" && <small>{t("locale.beta")}</small>}
            </label>
          ))}
        </fieldset>
        {failed && <p role="alert">{t("locale.failed")}</p>}
      </Dialog>
    </div>
  );
}
