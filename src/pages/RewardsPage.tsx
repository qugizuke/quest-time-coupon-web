/**
 * @file RewardsPage
 * @description 子ども向けポイント交換・報酬チケット管理（Issue #38 / #43）。固定カタログから複数枚を選んで申請し、
 *   自分の申請状況・月次履歴を確認する。申請時点では残高を変えない（承認時のみ反映）。
 *   Issue #43 以降は保有券の表示、券をポイントへ戻す申請、`balancePoints` 負債の穴埋めも扱う。
 *   正本: docs `screen-design.md` §6.7 / `api-tobe-f-contract.md` §3.11.1〜§3.11.4。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  homeQuery,
  pointExchangeRequestsQuery,
  queryKeys,
  rewardVoucherRefundRequestsQuery,
} from "@/api/queries";
import {
  postPointDebtOffset,
  postPointExchangeRequest,
  postRewardVoucherRefundRequest,
} from "@/api/client";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/month";
import { calcExchangeTotals, POINT_EXCHANGE_CATALOG } from "@/lib/pointExchangeCatalog";
import {
  POINT_EXCHANGE_STATUS_LABEL,
  formatDateTimeJstLabel,
  formatEffectsSummary,
  formatLineItemLabel,
  formatRefundLineItemLabel,
  pointExchangeStatusTone,
} from "@/lib/pointExchangeUi";
import {
  REWARD_VOUCHER_KEYS,
  REWARD_VOUCHER_LABELS,
  calcRewardVoucherTotals,
  hasEnoughRewardVouchers,
} from "@/lib/rewardVouchers";
import type {
  PointExchangeCatalogItemId,
  RewardVoucherCatalogItemId,
  RewardVouchers,
} from "@/types/api";

/** カタログ ID → 選択数量 */
type QuantityState = Record<PointExchangeCatalogItemId, number>;

/** 報酬チケット ID → 選択数量 */
type VoucherQuantityState = Record<RewardVoucherCatalogItemId, number>;

/** 交換画面内のタブ */
type RewardsTab = "exchange" | "refund" | "history";

/** ARIA tabs の表示順とラベル */
const REWARDS_TABS: ReadonlyArray<readonly [RewardsTab, string]> = [
  ["exchange", "🛒 交換する"],
  ["refund", "🔄 ポイントへ戻す"],
  ["history", "📋 履歴"],
];

/** Figmaから書き出したカタログアイコン */
const CATALOG_ICON: Record<PointExchangeCatalogItemId, string> = {
  "snack-10": "/assets/rewards/cookie.svg",
  "cash-100": "/assets/rewards/coins.svg",
  "dining-1000": "/assets/rewards/utensils.svg",
  "switch-30": "/assets/rewards/gamepad.svg",
  "switch-60": "/assets/rewards/gamepad.svg",
  "penalty-ticket-100": "/assets/rewards/ticket.svg",
};

/** 子ども向けの商品説明 */
const CATALOG_DESCRIPTION: Record<PointExchangeCatalogItemId, string> = {
  "snack-10": "がんばったごほうびにおやつ1つ！",
  "cash-100": "おこづかい100円ゲット！",
  "dining-1000": "みんなで外食に行こう！",
  "switch-30": "Switchで30分あそべるよ！",
  "switch-60": "Switchで60分あそべるよ！",
  "penalty-ticket-100": "ペナルティチケットを1枚消す",
};

/** Figmaの2列グリッドに合わせた表示順 */
const POINT_EXCHANGE_DISPLAY_CATALOG = [
  "snack-10",
  "cash-100",
  "dining-1000",
  "switch-30",
  "switch-60",
  "penalty-ticket-100",
].map((catalogItemId) => {
  const item = POINT_EXCHANGE_CATALOG.find(
    (candidate) => candidate.catalogItemId === catalogItemId,
  );
  if (!item) throw new Error(`表示カタログが未定義です: ${catalogItemId}`);
  return item;
});

/**
 * 全カタログを数量0で初期化する
 * @returns {QuantityState} 初期数量
 */
function initialQuantities(): QuantityState {
  const state = {} as QuantityState;
  for (const item of POINT_EXCHANGE_CATALOG) {
    state[item.catalogItemId] = 0;
  }
  return state;
}

/**
 * 報酬チケット5種を数量0で初期化する
 * @returns {VoucherQuantityState} 初期数量
 */
function initialVoucherQuantities(): VoucherQuantityState {
  const state = {} as VoucherQuantityState;
  for (const key of REWARD_VOUCHER_KEYS) {
    state[key] = 0;
  }
  return state;
}

/**
 * 保有券の数量ステッパー1行分
 * @param {object} props - props
 * @param {RewardVoucherCatalogItemId} props.catalogItemId - カタログ ID
 * @param {number} props.quantity - 選択中の数量
 * @param {number} props.maxQuantity - 保有枚数（上限）
 * @param {(delta: number) => void} props.onChange - 数量変更
 * @param {boolean} props.disabled - 操作不可か
 * @param {string} props.testIdPrefix - data-testid の接頭辞（セクション間で一意にする）
 * @param {string} props.ariaLabelPrefix - aria-label の接頭辞（セクション間で一意にする）
 * @returns {JSX.Element} 1行
 */
function VoucherQuantityRow({
  catalogItemId,
  quantity,
  maxQuantity,
  onChange,
  disabled,
  testIdPrefix,
  ariaLabelPrefix,
}: {
  catalogItemId: RewardVoucherCatalogItemId;
  quantity: number;
  maxQuantity: number;
  onChange: (delta: number) => void;
  disabled: boolean;
  testIdPrefix: string;
  ariaLabelPrefix: string;
}) {
  const label = REWARD_VOUCHER_LABELS[catalogItemId];
  return (
    <li
      className="flex items-center justify-between gap-3 rounded-default border-[3px] border-border-soft bg-surface-soft px-4 py-3"
      data-testid={`${testIdPrefix}-row-${catalogItemId}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{label}</p>
        <p className="text-sm text-muted">保有 {maxQuantity}枚</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-default border-[3px] border-border bg-surface text-lg font-bold text-ink disabled:opacity-40"
          onClick={() => onChange(-1)}
          disabled={quantity <= 0 || disabled}
          aria-label={`${ariaLabelPrefix}${label}を1個減らす`}
        >
          −
        </button>
        <span
          className="w-8 text-center text-lg font-bold text-ink"
          data-testid={`${testIdPrefix}-quantity-${catalogItemId}`}
        >
          {quantity}
        </span>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-default border-[3px] border-border bg-surface text-lg font-bold text-ink disabled:opacity-40"
          onClick={() => onChange(1)}
          disabled={quantity >= maxQuantity || disabled}
          aria-label={`${ariaLabelPrefix}${label}を1個増やす`}
        >
          ＋
        </button>
      </div>
    </li>
  );
}

/**
 * ポイント交換・報酬チケット画面（子ども）
 * @returns {JSX.Element} ページ
 */
export function RewardsPage() {
  const queryClient = useQueryClient();
  const { data: home, isLoading: homeLoading } = useQuery(homeQuery);
  const [quantities, setQuantities] = useState<QuantityState>(initialQuantities);
  const [refundQuantities, setRefundQuantities] = useState<VoucherQuantityState>(
    initialVoucherQuantities,
  );
  const [offsetQuantities, setOffsetQuantities] = useState<VoucherQuantityState>(
    initialVoucherQuantities,
  );
  const [month, setMonth] = useState(currentMonth());
  const [activeTab, setActiveTab] = useState<RewardsTab>("exchange");

  /** 矢印/Home/Endでタブを移動し、移動先を自動選択する。 */
  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: RewardsTab,
  ): void {
    const currentIndex = REWARDS_TABS.findIndex(([tab]) => tab === currentTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % REWARDS_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + REWARDS_TABS.length) % REWARDS_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = REWARDS_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = REWARDS_TABS[nextIndex][0];
    setActiveTab(nextTab);
    document.getElementById(`rewards-tab-${nextTab}`)?.focus();
  }

  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery(pointExchangeRequestsQuery(month));

  const {
    data: refundHistory,
    isLoading: refundHistoryLoading,
    error: refundHistoryError,
  } = useQuery(rewardVoucherRefundRequestsQuery(month));

  const totals = useMemo(() => {
    const items = POINT_EXCHANGE_CATALOG.map((item) => ({
      catalogItemId: item.catalogItemId,
      quantity: quantities[item.catalogItemId],
    })).filter((item) => item.quantity > 0);
    return calcExchangeTotals(items);
  }, [quantities]);

  const balancePoints = home?.balancePoints ?? 0;
  const rewardVouchers: RewardVouchers | undefined = home?.rewardVouchers;
  const isInDebt = balancePoints < 0;
  // 申請時点ではポイントを予約・減算しない。残高不足でも契約上は申請でき、
  // 保護者の承認トランザクションで最終残高が確定する。
  const canSubmit = totals.totalPoints > 0;

  const submitMutation = useMutation({
    mutationFn: () =>
      postPointExchangeRequest({
        items: POINT_EXCHANGE_CATALOG.map((item) => ({
          catalogItemId: item.catalogItemId,
          quantity: quantities[item.catalogItemId],
        })).filter((item) => item.quantity > 0),
      }),
    onSuccess: () => {
      setQuantities(initialQuantities());
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({
        queryKey: ["pointExchangeRequests"],
      });
    },
  });

  const refundTotals = useMemo(() => {
    const items = REWARD_VOUCHER_KEYS.map((catalogItemId) => ({
      catalogItemId,
      quantity: refundQuantities[catalogItemId],
    })).filter((item) => item.quantity > 0);
    return calcRewardVoucherTotals(items);
  }, [refundQuantities]);

  const canSubmitRefund =
    refundTotals.totalPoints > 0 &&
    !!rewardVouchers &&
    hasEnoughRewardVouchers(
      rewardVouchers,
      REWARD_VOUCHER_KEYS.map((catalogItemId) => ({
        catalogItemId,
        quantity: refundQuantities[catalogItemId],
      })).filter((item) => item.quantity > 0),
    );

  const refundMutation = useMutation({
    mutationFn: () =>
      postRewardVoucherRefundRequest({
        items: REWARD_VOUCHER_KEYS.map((catalogItemId) => ({
          catalogItemId,
          quantity: refundQuantities[catalogItemId],
        })).filter((item) => item.quantity > 0),
      }),
    onSuccess: () => {
      setRefundQuantities(initialVoucherQuantities());
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({
        queryKey: ["rewardVoucherRefundRequests"],
      });
    },
  });

  const offsetTotals = useMemo(() => {
    const items = REWARD_VOUCHER_KEYS.map((catalogItemId) => ({
      catalogItemId,
      quantity: offsetQuantities[catalogItemId],
    })).filter((item) => item.quantity > 0);
    return calcRewardVoucherTotals(items);
  }, [offsetQuantities]);

  const canSubmitOffset =
    isInDebt &&
    offsetTotals.totalPoints > 0 &&
    !!rewardVouchers &&
    hasEnoughRewardVouchers(
      rewardVouchers,
      REWARD_VOUCHER_KEYS.map((catalogItemId) => ({
        catalogItemId,
        quantity: offsetQuantities[catalogItemId],
      })).filter((item) => item.quantity > 0),
    );

  const offsetMutation = useMutation({
    mutationFn: () =>
      postPointDebtOffset({
        items: REWARD_VOUCHER_KEYS.map((catalogItemId) => ({
          catalogItemId,
          quantity: offsetQuantities[catalogItemId],
        })).filter((item) => item.quantity > 0),
      }),
    onSuccess: () => {
      setOffsetQuantities(initialVoucherQuantities());
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });

  /**
   * 指定カタログの数量を変更する
   * @param {PointExchangeCatalogItemId} catalogItemId - カタログ ID
   * @param {number} delta - 変化量（±1）
   * @returns {void}
   */
  function changeQuantity(catalogItemId: PointExchangeCatalogItemId, delta: number) {
    setQuantities((current) => ({
      ...current,
      [catalogItemId]: Math.max(0, current[catalogItemId] + delta),
    }));
  }

  /**
   * 戻し申請の数量を変更する（保有枚数を上限にする）
   * @param {RewardVoucherCatalogItemId} catalogItemId - カタログ ID
   * @param {number} delta - 変化量（±1）
   * @returns {void}
   */
  function changeRefundQuantity(catalogItemId: RewardVoucherCatalogItemId, delta: number) {
    const maxQuantity = rewardVouchers?.[catalogItemId] ?? 0;
    setRefundQuantities((current) => ({
      ...current,
      [catalogItemId]: Math.min(
        maxQuantity,
        Math.max(0, current[catalogItemId] + delta),
      ),
    }));
  }

  /**
   * 負債穴埋めの数量を変更する（保有枚数を上限にする）
   * @param {RewardVoucherCatalogItemId} catalogItemId - カタログ ID
   * @param {number} delta - 変化量（±1）
   * @returns {void}
   */
  function changeOffsetQuantity(catalogItemId: RewardVoucherCatalogItemId, delta: number) {
    const maxQuantity = rewardVouchers?.[catalogItemId] ?? 0;
    setOffsetQuantities((current) => ({
      ...current,
      [catalogItemId]: Math.min(
        maxQuantity,
        Math.max(0, current[catalogItemId] + delta),
      ),
    }));
  }

  if (homeLoading) {
    return <LoadingScreen />;
  }

  return (
    <ChildPageFrame>
      <div className="-mx-4 mb-4 bg-surface-warm px-4 py-6 sm:-mx-8 sm:px-8">
        <p className="text-sm text-muted">ごほうびショップ</p>
        <h1 className="mt-2 text-app-lg font-bold text-ink">今日のごほうびを選ぼう！</h1>
      </div>

      <Card className="mb-4 grid gap-4 sm:grid-cols-2" data-testid="rewards-balance-card">
        <div>
          <p className="text-sm text-muted">いまのポイント</p>
          <p
            className={`font-display text-app-xl leading-none ${isInDebt ? "text-danger" : "text-ink"}`}
            data-testid="rewards-balance-points"
          >
            {balancePoints}pt
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">使える時間</p>
          <p className="font-display text-3xl text-ink">{home?.switchMinutes ?? 0}分</p>
        </div>
      </Card>

      {isInDebt && (
        <Card
          className="mb-4 flex flex-col gap-4"
          tone="warm"
          data-testid="rewards-debt-offset-card"
        >
          <div>
            <h2 className="font-bold text-danger">ポイントがマイナスです</h2>
            <p className="text-sm text-muted">
              持っているチケットを選んで穴埋めできます（自動では消費しません）
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {REWARD_VOUCHER_KEYS.map((catalogItemId) => (
              <VoucherQuantityRow
                key={catalogItemId}
                catalogItemId={catalogItemId}
                quantity={offsetQuantities[catalogItemId]}
                maxQuantity={rewardVouchers?.[catalogItemId] ?? 0}
                onChange={(delta) => changeOffsetQuantity(catalogItemId, delta)}
                disabled={offsetMutation.isPending}
                testIdPrefix="offset-voucher"
                ariaLabelPrefix="穴埋めに使う"
              />
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-default border-[3px] border-border bg-surface-warm px-4 py-3">
            <span className="text-sm text-muted">穴埋め合計</span>
            <span className="font-display text-2xl text-ink" data-testid="offset-total-points">
              {offsetTotals.totalPoints}pt
            </span>
          </div>
          {offsetMutation.error && (
            <p className="text-sm text-danger" role="alert">
              {offsetMutation.error instanceof Error
                ? offsetMutation.error.message
                : "穴埋めに失敗しました"}
            </p>
          )}
          <Button
            fullWidth
            variant="danger"
            disabled={!canSubmitOffset || offsetMutation.isPending}
            onClick={() => offsetMutation.mutate()}
            data-testid="offset-submit"
          >
            {offsetMutation.isPending ? "処理中…" : "マイナスを穴埋めする"}
          </Button>
        </Card>
      )}

      {rewardVouchers && (
        <Card className="mb-4 flex flex-col gap-3" data-testid="rewards-vouchers-card">
          <h2 className="font-bold text-ink">保有券サマリー</h2>
          <ul className="flex flex-wrap gap-2">
            {REWARD_VOUCHER_KEYS.map((catalogItemId) => (
              <li
                key={catalogItemId}
                className="rounded-pill border border-border-soft bg-chip px-3 py-1 text-sm text-ink"
                data-testid={`rewards-voucher-stock-${catalogItemId}`}
              >
                {REWARD_VOUCHER_LABELS[catalogItemId]} {rewardVouchers[catalogItemId]}枚
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div
        className="mb-4 grid grid-cols-3 gap-2 rounded-default bg-white p-2"
        role="tablist"
        aria-label="ごほうびショップ"
      >
        {REWARDS_TABS.map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`rewards-tab-${tab}`}
            aria-controls={`rewards-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`min-h-16 rounded-default px-2 py-3 font-bold transition-colors ${
              activeTab === tab
                ? "bg-primary text-white"
                : "bg-chip text-ink hover:bg-surface-warm"
            }`}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, tab)}
            data-testid={`rewards-tab-${tab}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "exchange" && (
      <div id="rewards-panel-exchange" role="tabpanel" aria-labelledby="rewards-tab-exchange">
      <Card className="mb-4 flex flex-col gap-4" data-testid="rewards-catalog-card">
        <h2 className="font-bold text-ink">交換カタログ</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {POINT_EXCHANGE_DISPLAY_CATALOG.map((item) => {
            const quantity = quantities[item.catalogItemId];
            const voucherId = item.effects.issuedVoucherId;
            const owned = voucherId
              ? rewardVouchers?.[voucherId] ?? 0
              : home?.penaltyTicketCount ?? 0;
            const shortfall = Math.max(0, item.pointCost - balancePoints);
            return (
              <li
                key={item.catalogItemId}
                className={`flex min-h-56 flex-col gap-3 rounded-default border-[3px] bg-surface px-4 py-4 shadow-[var(--shadow-card)] ${
                  shortfall > 0 ? "border-dashed border-danger" : "border-border-soft"
                }`}
                data-testid={`catalog-item-${item.catalogItemId}`}
              >
                <div className="flex size-12 items-center justify-center rounded-default bg-surface-warm">
                  <img
                    src={CATALOG_ICON[item.catalogItemId]}
                    alt=""
                    className="size-8"
                    width="32"
                    height="32"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.label}</p>
                  <p className="text-sm text-muted">{item.pointCost}pt</p>
                </div>
                <p className="min-h-10 text-sm text-ink">
                  {CATALOG_DESCRIPTION[item.catalogItemId]}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="rounded-pill bg-chip px-3 py-1 text-xs text-ink">
                    所持 {owned}枚
                  </span>
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-default border-[3px] border-border bg-surface text-lg font-bold text-ink disabled:opacity-40"
                    onClick={() => changeQuantity(item.catalogItemId, -1)}
                    disabled={quantity <= 0 || submitMutation.isPending}
                    aria-label={`${item.label}を1個減らす`}
                  >
                    −
                  </button>
                  <span
                    className="w-8 text-center text-lg font-bold text-ink"
                    data-testid={`catalog-quantity-${item.catalogItemId}`}
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-default border-[3px] border-border bg-surface text-lg font-bold text-ink disabled:opacity-40"
                    onClick={() => changeQuantity(item.catalogItemId, 1)}
                    disabled={submitMutation.isPending}
                    aria-label={`${item.label}を1個増やす`}
                  >
                    ＋
                  </button>
                  </div>
                </div>
                {shortfall > 0 && (
                  <p className="text-sm font-bold text-danger">あと{shortfall}pt</p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between rounded-default border-[3px] border-border bg-surface-warm px-4 py-3">
          <span className="text-sm text-muted">合計</span>
          <span className="font-display text-2xl text-ink" data-testid="rewards-total-points">
            {totals.totalPoints}pt
          </span>
        </div>

        {totals.totalPoints > 0 && totals.totalPoints > balancePoints && (
          <p className="text-sm text-danger" data-testid="rewards-insufficient-balance">
            承認されると残高がマイナスになります。申請後に保護者が確認します。
          </p>
        )}

        {submitMutation.error && (
          <p className="text-sm text-danger" role="alert">
            {submitMutation.error instanceof Error
              ? submitMutation.error.message
              : "申請に失敗しました"}
          </p>
        )}

        <Button
          fullWidth
          disabled={!canSubmit || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
          data-testid="rewards-submit"
        >
          {submitMutation.isPending ? "申請中…" : "交換を申請する"}
        </Button>
      </Card>
      </div>
      )}

      {activeTab === "refund" && rewardVouchers && (
        <div id="rewards-panel-refund" role="tabpanel" aria-labelledby="rewards-tab-refund">
        <Card className="mb-4 flex flex-col gap-4" data-testid="rewards-refund-card">
          <div>
            <h2 className="font-bold text-ink">チケットをポイントに戻す</h2>
            <p className="text-sm text-muted">申請後はママの承認待ちになります</p>
          </div>
          <ul className="flex flex-col gap-3">
            {REWARD_VOUCHER_KEYS.map((catalogItemId) => (
              <VoucherQuantityRow
                key={catalogItemId}
                catalogItemId={catalogItemId}
                quantity={refundQuantities[catalogItemId]}
                maxQuantity={rewardVouchers[catalogItemId]}
                onChange={(delta) => changeRefundQuantity(catalogItemId, delta)}
                disabled={refundMutation.isPending}
                testIdPrefix="refund-voucher"
                ariaLabelPrefix="戻す"
              />
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-default border-[3px] border-border bg-surface-warm px-4 py-3">
            <span className="text-sm text-muted">戻る合計</span>
            <span className="font-display text-2xl text-ink" data-testid="refund-total-points">
              {refundTotals.totalPoints}pt
            </span>
          </div>
          {refundMutation.error && (
            <p className="text-sm text-danger" role="alert">
              {refundMutation.error instanceof Error
                ? refundMutation.error.message
                : "申請に失敗しました"}
            </p>
          )}
          <Button
            fullWidth
            variant="secondary"
            disabled={!canSubmitRefund || refundMutation.isPending}
            onClick={() => refundMutation.mutate()}
            data-testid="refund-submit"
          >
            {refundMutation.isPending ? "申請中…" : "ポイントに戻す申請をする"}
          </Button>
        </Card>
        </div>
      )}

      {activeTab === "history" && (
      <div id="rewards-panel-history" role="tabpanel" aria-labelledby="rewards-tab-history">
      <Card className="mb-4" data-testid="rewards-history-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            className="px-3 text-base"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            data-testid="rewards-prev-month"
          >
            ← 前月
          </Button>
          <p className="text-center text-sm font-medium text-ink" data-testid="rewards-month-label">
            {formatMonthLabel(month)}
          </p>
          <Button
            variant="secondary"
            className="px-3 text-base"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            data-testid="rewards-next-month"
          >
            翌月 →
          </Button>
        </div>

        <h2 className="mb-2 font-bold text-ink">交換の履歴</h2>
        {historyLoading && <p className="text-muted">読み込み中…</p>}
        {historyError && (
          <p className="text-danger">
            {historyError instanceof Error ? historyError.message : "エラー"}
          </p>
        )}

        {!historyLoading && (history?.items ?? []).length === 0 && (
          <p className="text-sm text-muted" data-testid="rewards-history-empty">
            この月の申請はありません
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {(history?.items ?? []).map((request) => (
            <li
              key={request.id}
              className="rounded-default border-[3px] border-border-soft bg-surface px-4 py-3"
              data-testid={`rewards-history-item-${request.id}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm text-muted">
                  {formatDateTimeJstLabel(request.requestedAt)}
                </span>
                <StatusBadge tone={pointExchangeStatusTone(request.status)}>
                  {POINT_EXCHANGE_STATUS_LABEL[request.status]}
                </StatusBadge>
              </div>
              <ul className="mb-1 flex flex-col gap-0.5 text-sm text-ink">
                {request.items.map((line) => (
                  <li key={line.catalogItemId}>{formatLineItemLabel(line)}</li>
                ))}
              </ul>
              <p className="text-sm font-bold text-ink">合計 {request.totalPoints}pt</p>
              {request.status === "approved" && (
                <p className="text-sm text-success">
                  反映: {formatEffectsSummary(request.effects)}
                </p>
              )}
              {request.status === "rejected" && request.rejectReason && (
                <p className="text-sm text-muted">理由: {request.rejectReason}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card data-testid="rewards-refund-history-card">
        <h2 className="mb-2 font-bold text-ink">戻し申請の履歴</h2>
        {refundHistoryLoading && <p className="text-muted">読み込み中…</p>}
        {refundHistoryError && (
          <p className="text-danger">
            {refundHistoryError instanceof Error ? refundHistoryError.message : "エラー"}
          </p>
        )}

        {!refundHistoryLoading && (refundHistory?.items ?? []).length === 0 && (
          <p className="text-sm text-muted" data-testid="rewards-refund-history-empty">
            この月の戻し申請はありません
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {(refundHistory?.items ?? []).map((request) => (
            <li
              key={request.id}
              className="rounded-default border-[3px] border-border-soft bg-surface px-4 py-3"
              data-testid={`rewards-refund-history-item-${request.id}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm text-muted">
                  {formatDateTimeJstLabel(request.requestedAt)}
                </span>
                <StatusBadge tone={pointExchangeStatusTone(request.status)}>
                  {POINT_EXCHANGE_STATUS_LABEL[request.status]}
                </StatusBadge>
              </div>
              <ul className="mb-1 flex flex-col gap-0.5 text-sm text-ink">
                {request.items.map((line) => (
                  <li key={line.catalogItemId}>{formatRefundLineItemLabel(line)}</li>
                ))}
              </ul>
              <p className="text-sm font-bold text-ink">合計 {request.totalPoints}pt</p>
              {request.status === "rejected" && request.rejectReason && (
                <p className="text-sm text-muted">理由: {request.rejectReason}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>
      </div>
      )}
    </ChildPageFrame>
  );
}
