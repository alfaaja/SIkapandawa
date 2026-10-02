// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { AdminUserListItem } from '../types';
import { ProgressCharts } from './ProgressCharts';

function player(overrides: Partial<AdminUserListItem> = {}): AdminUserListItem {
    return {
        userId: '123e4567-e89b-42d3-a456-426614174000',
        displayName: 'Fahmi Nuriya',
        schoolName: 'SDN Kalibanteng Kulon 01',
        username: 'fahmi',
        registeredAt: '2026-08-01T00:00:00.000Z',
        highestUnlockedLevel: 10,
        completedLevelCount: 10,
        totalStars: 11,
        jejakPandawaUnlocked: true,
        jejakPandawaBestScore: 7,
        progressUpdatedAt: '2026-08-02T00:00:00.000Z',
        status: 'completed',
        ...overrides
    };
}

describe('ProgressCharts', () => {
    it('renders both score scales in registration order and excludes the admin', () => {
        const charts = new ProgressCharts('admin-id', 'sikapandawa');

        charts.render([
            player({
                userId: 'student-2',
                displayName: 'Lisa Hidayanti',
                username: 'lisa-hidayanti',
                registeredAt: '2026-08-02T00:00:00.000Z',
                totalStars: 15,
                jejakPandawaBestScore: 8
            }),
            player({ userId: 'admin-id', displayName: 'Admin', username: 'sikapandawa' }),
            player({ userId: 'student-1' })
        ], 'SDN Kalibanteng Kulon 01');

        expect(charts.element.textContent).toContain('Capaian Misi Pandawa');
        expect(charts.element.textContent).toContain('Capaian Jejak Pandawa');
        expect(charts.element.textContent).toContain('11/30');
        expect(charts.element.textContent).toContain('7/10');
        expect(charts.element.textContent).not.toContain('Admin');
        expect(Array.from(charts.element.querySelectorAll('.chart-name')).map(
            (element) => element.textContent
        )).toEqual([
            '1. Fahmi Nuriya', '2. Lisa Hidayanti',
            '1. Fahmi Nuriya', '2. Lisa Hidayanti'
        ]);
        expect(charts.element.querySelectorAll('.chart-panel')).toHaveLength(2);
        expect(charts.element.querySelectorAll('.chart-bar')).toHaveLength(4);
    });

    it('treats profile text as text and uses an admin username fallback', () => {
        const charts = new ProgressCharts(null, 'Sikapandawa');

        charts.render([
            player({ userId: 'admin', username: 'sikapandawa', displayName: 'Admin' }),
            player({
                userId: 'student',
                username: 'student',
                displayName: '<img src=x onerror=alert(1)>'
            })
        ], 'SDN Kalibanteng Kulon 01');

        expect(charts.element.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(charts.element.querySelector('img')).toBeNull();
        expect(charts.element.textContent).not.toContain('Admin');
        expect(charts.element.querySelector('.chart-bar')?.getAttribute('aria-label'))
            .toContain('11 dari 30');
    });

    it('keeps unexpected score values inside chart bounds', () => {
        const charts = new ProgressCharts(null, 'sikapandawa');

        charts.render([
            player({
                userId: 'student',
                totalStars: 40,
                jejakPandawaBestScore: -2
            })
        ], 'SDN Kalibanteng Kulon 01');

        const bars = Array.from(charts.element.querySelectorAll<HTMLElement>('.chart-bar'));
        expect(bars.map((bar) => bar.style.getPropertyValue('--bar-height')))
            .toEqual(['100%', '0%']);
        expect(charts.element.textContent).toContain('30/30');
        expect(charts.element.textContent).toContain('0/10');
    });

    it('marks zero values so they do not show a misleading minimum-height bar', () => {
        const charts = new ProgressCharts(null, 'sikapandawa');

        charts.render([player({ totalStars: 0, jejakPandawaBestScore: 0 })], 'SDN Kalibanteng Kulon 01');

        expect(charts.element.querySelectorAll('.chart-bar-zero')).toHaveLength(2);
    });

    it('toggles every chart label between full names and two-letter initials', () => {
        const charts = new ProgressCharts(null, 'sikapandawa');
        charts.render([
            player({ userId: 'student-1' }),
            player({ userId: 'student-2', displayName: 'M. Dika Saputra' })
        ], 'SDN Kalibanteng Kulon 01');

        const modeButton = charts.element.querySelector<HTMLButtonElement>(
            '[data-testid="chart-name-mode"]'
        )!;
        expect(modeButton.textContent).toBe('Mode ringkas');
        expect(modeButton.getAttribute('aria-pressed')).toBe('false');

        modeButton.click();

        expect(charts.element.classList.contains('progress-charts-compact')).toBe(true);
        expect(Array.from(charts.element.querySelectorAll('.chart-name')).map(
            (element) => element.textContent
        )).toEqual(['1. FA', '2. MD', '1. FA', '2. MD']);
        expect(modeButton.textContent).toBe('Nama lengkap');
        expect(modeButton.getAttribute('aria-pressed')).toBe('true');
        expect(charts.element.querySelector('.chart-bar')?.getAttribute('aria-label'))
            .toContain('Fahmi Nuriya');

        modeButton.click();

        expect(charts.element.classList.contains('progress-charts-compact')).toBe(false);
        expect(Array.from(charts.element.querySelectorAll('.chart-name')).map(
            (element) => element.textContent
        )).toEqual([
            '1. Fahmi Nuriya', '2. M. Dika Saputra',
            '1. Fahmi Nuriya', '2. M. Dika Saputra'
        ]);
    });
});
