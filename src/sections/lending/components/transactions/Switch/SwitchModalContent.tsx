import { normalize, normalizeBN } from "@aave/math-utils"
import { SwitchVerticalIcon } from "@heroicons/react/outline"

import {
  Box,
  CircularProgress,
  IconButton,
  SvgIcon,
  Typography,
} from "@mui/material"
import { debounce } from "lodash"
import { useMemo, useState } from "react"
import { FormattedNumber } from "sections/lending/components/primitives/FormattedNumber"
import { Row } from "sections/lending/components/primitives/Row"
import { ConnectWalletButton } from "sections/lending/components/WalletConnection/ConnectWalletButton"
import { useParaswapSellRates } from "sections/lending/hooks/paraswap/useParaswapRates"
import { useIsWrongNetwork } from "sections/lending/hooks/useIsWrongNetwork"
import { useModalContext } from "sections/lending/hooks/useModal"
import { useWeb3Context } from "sections/lending/libs/hooks/useWeb3Context"
import { useRootStore } from "sections/lending/store/root"
import {
  getNetworkConfig,
  NetworkConfig,
} from "sections/lending/utils/marketsAndNetworksConfig"

import { AssetInput } from "sections/lending/ui/transactions/AssetInput"
import { TxModalDetails } from "sections/lending/components/transactions/FlowCommons/TxModalDetails"
import { TxModalTitle } from "sections/lending/components/transactions/FlowCommons/TxModalTitle"
import { ChangeNetworkWarning } from "sections/lending/components/transactions/Warnings/ChangeNetworkWarning"
import { ParaswapErrorDisplay } from "sections/lending/components/transactions/Warnings/ParaswapErrorDisplay"
import { SupportedNetworkWithChainId } from "./common"
import { NetworkSelector } from "./NetworkSelector"
import { SwitchActions } from "./SwitchActions"
import { SwitchErrors } from "./SwitchErrors"
import { ReserveWithBalance } from "./SwitchModal"
import { SwitchRates } from "./SwitchRates"
import { SwitchSlippageSelector } from "./SwitchSlippageSelector"
import { SwitchTxSuccessView } from "./SwitchTxSuccessView"

interface SwitchModalContentProps {
  selectedChainId: number
  setSelectedChainId: (value: number) => void
  supportedNetworks: SupportedNetworkWithChainId[]
  reserves: ReserveWithBalance[]
  selectedNetworkConfig: NetworkConfig
  defaultAsset?: string
}

export const SwitchModalContent = ({
  supportedNetworks,
  selectedChainId,
  setSelectedChainId,
  reserves,
  selectedNetworkConfig,
  defaultAsset,
}: SwitchModalContentProps) => {
  const [slippage, setSlippage] = useState("0.001")
  const [inputAmount, setInputAmount] = useState("")
  const [debounceInputAmount, setDebounceInputAmount] = useState("")
  const {
    mainTxState: switchTxState,
    gasLimit,
    txError,
    setTxError,
  } = useModalContext()
  const user = useRootStore((store) => store.account)
  const [selectedInputReserve, setSelectedInputReserve] = useState(() => {
    const defaultReserve = reserves.find(
      (elem) => elem.underlyingAsset === defaultAsset,
    )
    if (defaultReserve) return defaultReserve
    if (reserves[0].symbol === "GHO") {
      return reserves[1]
    }
    return reserves[0]
  })
  const { readOnlyModeAddress } = useWeb3Context()
  const [selectedOutputReserve, setSelectedOutputReserve] = useState(() => {
    const gho = reserves.find((reserve) => reserve.symbol === "GHO")
    if (gho) return gho
    return (
      reserves.find(
        (elem) =>
          elem.underlyingAsset !== defaultAsset &&
          elem.underlyingAsset !== reserves[0].underlyingAsset,
      ) || reserves[1]
    )
  })
  const isWrongNetwork = useIsWrongNetwork(selectedChainId)

  const handleInputChange = (value: string) => {
    setTxError(undefined)
    if (value === "-1") {
      setInputAmount(selectedInputReserve.balance)
      debouncedInputChange(selectedInputReserve.balance)
    } else {
      setInputAmount(value)
      debouncedInputChange(value)
    }
  }

  const debouncedInputChange = useMemo(() => {
    return debounce((value: string) => {
      setDebounceInputAmount(value)
    }, 300)
  }, [setDebounceInputAmount])

  const {
    data: sellRates,
    error: ratesError,
    isFetching: ratesLoading,
  } = useParaswapSellRates({
    chainId: selectedNetworkConfig.underlyingChainId ?? selectedChainId,
    amount:
      debounceInputAmount === ""
        ? "0"
        : normalizeBN(
            debounceInputAmount,
            -1 * selectedInputReserve.decimals,
          ).toFixed(0),
    srcToken: selectedInputReserve.underlyingAsset,
    srcDecimals: selectedInputReserve.decimals,
    destToken: selectedOutputReserve.underlyingAsset,
    destDecimals: selectedOutputReserve.decimals,
    user,
    options: {
      partner: "aave-widget",
    },
  })

  if (sellRates && switchTxState.success) {
    return (
      <SwitchTxSuccessView
        txHash={switchTxState.txHash}
        amount={debounceInputAmount}
        symbol={selectedInputReserve.symbol}
        iconSymbol={selectedInputReserve.iconSymbol}
        outSymbol={selectedOutputReserve.symbol}
        outIconSymbol={selectedOutputReserve.iconSymbol}
        outAmount={(
          Number(normalize(sellRates.destAmount, sellRates.destDecimals)) *
          (1 - Number(slippage))
        ).toString()}
      />
    )
  }

  const onSwitchReserves = () => {
    const fromReserve = selectedInputReserve
    const toReserve = selectedOutputReserve
    const toInput = sellRates
      ? normalizeBN(sellRates.destAmount, sellRates.destDecimals).toString()
      : "0"
    setSelectedInputReserve(toReserve)
    setSelectedOutputReserve(fromReserve)
    setInputAmount(toInput)
    setDebounceInputAmount(toInput)
    setTxError(undefined)
  }

  const handleSelectedInputReserve = (reserve: ReserveWithBalance) => {
    setTxError(undefined)
    setSelectedInputReserve(reserve)
  }

  const handleSelectedOutputReserve = (reserve: ReserveWithBalance) => {
    setTxError(undefined)
    setSelectedOutputReserve(reserve)
  }

  const handleSelectedNetworkChange = (value: number) => {
    setTxError(undefined)
    setSelectedChainId(value)
  }

  return (
    <>
      <TxModalTitle title="Switch tokens" />
      {isWrongNetwork.isWrongNetwork && !readOnlyModeAddress && (
        <ChangeNetworkWarning
          networkName={getNetworkConfig(selectedChainId).name}
          chainId={selectedChainId}
        />
      )}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <NetworkSelector
          networks={supportedNetworks}
          selectedNetwork={selectedChainId}
          setSelectedNetwork={handleSelectedNetworkChange}
        />
        <SwitchSlippageSelector slippage={slippage} setSlippage={setSlippage} />
      </Box>
      {!selectedInputReserve || !selectedOutputReserve ? (
        <CircularProgress />
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              gap: "15px",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <AssetInput
              name="switch-amount-1"
              assets={reserves.filter(
                (elem) =>
                  elem.underlyingAsset !==
                  selectedOutputReserve.underlyingAsset,
              )}
              value={inputAmount}
              onChange={handleInputChange}
              usdValue={sellRates?.srcUSD || "0"}
              symbol={selectedInputReserve?.symbol}
              onSelect={handleSelectedInputReserve}
              inputTitle={" "}
              sx={{ width: "100%" }}
            />
            <IconButton
              onClick={onSwitchReserves}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                position: "absolute",
                backgroundColor: "background.paper",
              }}
            >
              <SvgIcon sx={{ color: "primary.main", fontSize: "18px" }}>
                <SwitchVerticalIcon />
              </SvgIcon>
            </IconButton>
            <AssetInput
              name="switch-amount-2"
              assets={reserves.filter(
                (elem) =>
                  elem.underlyingAsset !== selectedInputReserve.underlyingAsset,
              )}
              value={
                sellRates
                  ? normalizeBN(
                      sellRates.destAmount,
                      sellRates.destDecimals,
                    ).toString()
                  : "0"
              }
              usdValue={sellRates?.destUSD || "0"}
              symbol={selectedOutputReserve?.symbol}
              loading={
                debounceInputAmount !== "0" &&
                debounceInputAmount !== "" &&
                ratesLoading &&
                !ratesError
              }
              onSelect={handleSelectedOutputReserve}
              disableInput={true}
              inputTitle={" "}
              sx={{ width: "100%" }}
            />
          </Box>
          {sellRates && (
            <>
              <SwitchRates
                rates={sellRates}
                srcSymbol={selectedInputReserve.symbol}
                destSymbol={selectedOutputReserve.symbol}
              />
            </>
          )}
          {sellRates && user && (
            <TxModalDetails gasLimit={gasLimit} chainId={selectedChainId}>
              <Row caption={`Minimum ${selectedOutputReserve.symbol} received`}>
                <FormattedNumber
                  compact={false}
                  roundDown={true}
                  variant="caption"
                  value={
                    Number(
                      normalize(sellRates.destAmount, sellRates.destDecimals),
                    ) *
                    (1 - Number(slippage))
                  }
                />
              </Row>
              <Row
                sx={{ mt: 4 }}
                caption={<span>Minimum USD value received</span>}
              >
                <FormattedNumber
                  symbol="usd"
                  symbolsVariant="caption"
                  variant="caption"
                  value={Number(sellRates.destUSD) * (1 - Number(slippage))}
                />
              </Row>
            </TxModalDetails>
          )}
          {user ? (
            <>
              <SwitchErrors
                ratesError={ratesError}
                balance={selectedInputReserve.balance}
                inputAmount={debounceInputAmount}
              />
              {txError && <ParaswapErrorDisplay txError={txError} />}
              <SwitchActions
                isWrongNetwork={isWrongNetwork.isWrongNetwork}
                inputAmount={debounceInputAmount}
                inputToken={selectedInputReserve.underlyingAsset}
                outputToken={selectedOutputReserve.underlyingAsset}
                inputName={selectedInputReserve.name}
                outputName={selectedOutputReserve.name}
                slippage={slippage}
                blocked={
                  !sellRates ||
                  Number(debounceInputAmount) >
                    Number(selectedInputReserve.balance) ||
                  !user
                }
                chainId={selectedChainId}
                route={sellRates}
              />
            </>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                mt: 4,
                alignItems: "center",
              }}
            >
              <Typography
                sx={{ mb: 24, textAlign: "center" }}
                color="text.secondary"
              >
                <span>
                  Please connect your wallet to be able to switch your tokens.
                </span>
              </Typography>
              <ConnectWalletButton />
            </Box>
          )}
        </>
      )}
    </>
  )
}
