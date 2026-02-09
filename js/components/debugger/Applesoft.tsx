import { useCallback, useEffect, useRef, useState } from 'react';

import { toHex } from 'js/util';
import ApplesoftDecompiler from 'js/applesoft/decompiler';
import { ApplesoftHeap, ApplesoftVariable } from 'js/applesoft/heap';
import { Apple2 as Apple2Impl } from 'js/apple2';

import styles from './css/Applesoft.module.scss';
import debuggerStyles from './css/Debugger.module.scss';

export interface ApplesoftProps {
    apple2: Apple2Impl | undefined;
}

interface ApplesoftData {
    variables: ApplesoftVariable[];
    internals: {
        txttab?: number;
        fac?: number;
        arg?: number;
        curline?: number;
    };
    listing: string;
}

const TYPE_SYMBOL = ['', '$', '()', '%'] as const;
const TYPE_NAME = ['Float', 'String', 'Function', 'Integer'] as const;

const formatArray = (value: unknown): string => {
    if (Array.isArray(value)) {
        if (Array.isArray(value[0])) {
            return `[${value.map((x) => formatArray(x)).join(',\n ')}]`;
        } else {
            return `[${value.map((x) => formatArray(x)).join(', ')}]`;
        }
    } else {
        return `${JSON.stringify(value)}`;
    }
};

const Variable = ({ variable }: { variable: ApplesoftVariable }) => {
    const { name, type, sizes, value } = variable;
    const isArray = !!sizes;
    const arrayStr = isArray
        ? `(${sizes.map((size) => size - 1).join(',')})`
        : '';
    return (
        <tr>
            <td>
                {name}
                {TYPE_SYMBOL[type]}
                {arrayStr}
            </td>
            <td>
                {TYPE_NAME[type]}
                {isArray ? ' Array' : ''}
            </td>
            <td>
                <pre tabIndex={-1}>{isArray ? formatArray(value) : value}</pre>
            </td>
        </tr>
    );
};

export const Applesoft = ({ apple2 }: ApplesoftProps) => {
    const animationRef = useRef<number>(0);
    const [data, setData] = useState<ApplesoftData>({
        listing: '',
        variables: [],
        internals: {},
    });
    const [heap, setHeap] = useState<ApplesoftHeap>();
    const cpu = apple2?.getCPU();

    useEffect(() => {
        if (cpu) {
            // setDecompiler();
            setHeap(new ApplesoftHeap(cpu));
        }
    }, [cpu]);

    const animate = useCallback(() => {
        if (cpu && heap) {
            try {
                const decompiler =
                    ApplesoftDecompiler.decompilerFromMemory(cpu);
                setData({
                    variables: heap.dumpVariables(),
                    internals: heap.dumpInternals(),
                    listing: decompiler.decompile(),
                });
            } catch (error) {
                if (error instanceof Error) {
                    setData({
                        variables: [],
                        internals: {},
                        listing: error.message,
                    });
                } else {
                    throw error;
                }
            }
        }
        animationRef.current = requestAnimationFrame(animate);
    }, [cpu, heap]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
    }, [animate]);

    const { listing, internals, variables } = data;

    return (
        <div className={styles.column}>
            <span className={debuggerStyles.subHeading}>Listing</span>
            <pre className={styles.listing} tabIndex={-1}>
                {listing}
            </pre>
            <span className={debuggerStyles.subHeading}>Variables</span>
            <div className={styles.variables}>
                <table>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Value</th>
                    </tr>
                    {variables.map((variable, idx) => (
                        <Variable key={idx} variable={variable} />
                    ))}
                </table>
            </div>
            <span className={debuggerStyles.subHeading}>Internals</span>
            <div className={styles.internals}>
                <table>
                    <tr>
                        <th>TXTTAB</th>
                        <td>{toHex(internals.txttab ?? 0)}</td>
                        <th>FAC</th>
                        <td>{internals.fac}</td>
                    </tr>
                    <tr>
                        <th>ARG</th>
                        <td>{internals.arg}</td>
                        <th>CURLINE</th>
                        <td>{internals.curline}</td>
                    </tr>
                </table>
            </div>
        </div>
    );
};
