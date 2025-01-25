		ORG	$C700

; Slot scan ZP addresses
SCAN_LO		EQU	$00
SCAN_HI		EQU	$01

; ProDOS
COMMAND		EQU	$42
UNIT		EQU	$43
ADDRESS_LO	EQU	$44
ADDRESS_HI	EQU	$45
BLOCK_LO	EQU	$46
BLOCK_HI 	EQU	$47

MSLOT		EQU	$7F8

; Slot I/O addresses
STATUS		EQU	$C080
READY           EQU     $C081
XREG            EQU     $C082
YREG            EQU     $C083
CARRY		EQU     $C084

; ROM addresses
BASIC		EQU	$E000
SLOOP		EQU	$FABA		; Resume boot scan
ROMRTS		EQU 	$FF58
BOOT		EQU	$0801

		LDX	#$20		; $20 $00 $03 $00 - Smartport signature
		LDX	#$00		; $20 $00 $03 $3C - Vanilla disk signature
		LDX	#$03
		LDX	#$00		; Override with $3C for DumbPort
; Determine our slot
		JSR	ROMRTS
		TSX
		LDA	$0100,X
		STA	MSLOT		; $Cn
		ASL
		ASL
		ASL
		ASL
		TAY			; $n0
; Load the disk status bits
		LDA	STATUS,Y
		LSR			; Check for Disk 1
		BCS	DISKREADY	; Boot from Disk 1
		LDA	SCAN_LO
		BNE	GO_BASIC
		LDA	SCAN_HI
		CMP	MSLOT
		BNE	GO_BASIC
		JMP	SLOOP		; Go back to scanning
GO_BASIC	JMP	BASIC		; Go to basic
; Boot routine
DISKREADY	LDX     #$01		; Read
		STX	COMMAND
		DEX
		STX	BLOCK_LO	; Block 0
		STX	BLOCK_HI
		STX	ADDRESS_LO	; Into $800
		LDX	#$08
		STX	ADDRESS_HI
		LDA	MSLOT
		PHA			; Save slot address
		PHA			; RTS address hi byte
		LDA	#REENTRY - 1
		PHA                     ; RTS address lo byte
		CLV
		BVC	BLOCK_ENT
REENTRY		PLA			; Restore slot address
		ASL			; Make I/O register index
		ASL
		ASL
		ASL
		TAX
		JMP	BOOT
		DS	2
BLOCK_ENT	JMP	COMMON_ENT
SMARTPORT_ENT	JMP	COMMON_ENT
COMMON_ENT      LDA	$00	; Save $00
		PHA
		LDA	#$60	; Create a known RTS because ROM may be unavailable
		STA	$00
		JSR	$0000
		TSX
		LDA	$0100,X	; Load ROM high byte
		ASL		; Convert to index for I/O register
		ASL
		ASL
		ASL
		TAX
		PLA		; Restore $00
		STA	$00
BUSY_LOOP	LDA	READY,X	; STATUS will return $80 until ready
		BMI	BUSY_LOOP
		PHA             ; Save A
		LDA	XREG,X  ; Read X register
		PHA             ; Save X
		LDA	YREG,X  ; Read Y register
		PHA             ; Save Y
		LDA     CARRY,X ; Get Carry status
		ROR     A       ; Set or clear carry
		PLY		; Restore Y
		PLX		; Restore X
		PLA             ; Restore A
		RTS
PADDING		DS	$C7FE - PADDING
		ORG	$C7FE
FLAGS		DFB	$D7
ENTRY_LO	DFB	BLOCK_ENT

		END
