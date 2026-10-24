import { Injectable } from '@nestjs/common';

import { Patient } from '../patients/entities/patient.entity';
import { OdontogramEntry } from './entities/odontogram-entry.entity';
import { ToothStatus } from './interfaces/tooth-status.enum';
import { ToothSurface } from './interfaces/tooth-surface.enum';

interface PdfObject {
  id: number;
  body: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;

const STATUS_META: Record<
  ToothStatus,
  { label: string; abbr: string; color: [number, number, number] }
> = {
  [ToothStatus.HEALTHY]: {
    label: 'Sano',
    abbr: 'S',
    color: [0.92, 0.94, 0.96],
  },
  [ToothStatus.CARIES]: {
    label: 'Caries',
    abbr: 'CA',
    color: [0.98, 0.55, 0.55],
  },
  [ToothStatus.MISSING]: {
    label: 'Ausente',
    abbr: 'AU',
    color: [0.63, 0.67, 0.73],
  },
  [ToothStatus.RESTORED]: {
    label: 'Restaurado',
    abbr: 'R',
    color: [0.56, 0.74, 0.98],
  },
  [ToothStatus.ENDODONTICS]: {
    label: 'Endodoncia',
    abbr: 'EN',
    color: [0.75, 0.62, 0.95],
  },
  [ToothStatus.CROWN]: {
    label: 'Corona',
    abbr: 'CO',
    color: [0.98, 0.86, 0.42],
  },
  [ToothStatus.IMPLANT]: {
    label: 'Implante',
    abbr: 'IM',
    color: [0.48, 0.82, 0.62],
  },
  [ToothStatus.EXTRACTION_INDICATED]: {
    label: 'Extraccion indicada',
    abbr: 'EX',
    color: [0.9, 0.22, 0.22],
  },
  [ToothStatus.OBSERVATION]: {
    label: 'Observacion',
    abbr: 'OB',
    color: [0.95, 0.75, 0.45],
  },
};

@Injectable()
export class OdontogramPdfService {
  generate(input: {
    patient: Patient;
    entries: OdontogramEntry[];
    generatedAt: Date;
  }): Buffer {
    const pages = [
      this.buildCoverPage(input.patient, input.entries, input.generatedAt),
      ...this.buildTablePages(input.entries),
    ];

    return this.buildPdf(pages);
  }

  private buildCoverPage(
    patient: Patient,
    entries: OdontogramEntry[],
    generatedAt: Date,
  ): string {
    const commands: string[] = [];

    this.text(commands, 'DentalHub - Odontograma', MARGIN, 742, 18);
    this.text(
      commands,
      `Paciente: ${patient.firstName} ${patient.lastName}`,
      MARGIN,
      716,
      11,
    );
    this.text(commands, `ID paciente: ${patient.id}`, MARGIN, 700, 9);
    this.text(
      commands,
      `Fecha: ${generatedAt.toISOString().slice(0, 10)}`,
      MARGIN,
      684,
      9,
    );

    this.text(commands, 'Dentigrama visual', MARGIN, 650, 13);
    this.drawDentigram(commands, entries, 72, 565);
    this.drawLegend(commands, 72, 424);

    this.text(commands, 'Resumen tabular', MARGIN, 360, 13);
    this.drawTableHeader(commands, 48, 336);
    this.drawRows(commands, entries.slice(0, 16), 48, 316);

    if (entries.length > 16) {
      this.text(
        commands,
        `Continua en paginas siguientes (${entries.length - 16} registros mas).`,
        48,
        54,
        8,
      );
    }

    return commands.join('\n');
  }

  private buildTablePages(entries: OdontogramEntry[]): string[] {
    const extraEntries = entries.slice(16);
    const pages: string[] = [];

    for (let i = 0; i < extraEntries.length; i += 30) {
      const pageEntries = extraEntries.slice(i, i + 30);
      const commands: string[] = [];

      this.text(commands, 'Odontograma - resumen tabular', 48, 742, 14);
      this.drawTableHeader(commands, 48, 714);
      this.drawRows(commands, pageEntries, 48, 694);
      pages.push(commands.join('\n'));
    }

    return pages;
  }

  private drawDentigram(
    commands: string[],
    entries: OdontogramEntry[],
    startX: number,
    startY: number,
  ) {
    const rows = [
      [
        '18',
        '17',
        '16',
        '15',
        '14',
        '13',
        '12',
        '11',
        '21',
        '22',
        '23',
        '24',
        '25',
        '26',
        '27',
        '28',
      ],
      [
        '48',
        '47',
        '46',
        '45',
        '44',
        '43',
        '42',
        '41',
        '31',
        '32',
        '33',
        '34',
        '35',
        '36',
        '37',
        '38',
      ],
    ];
    const entryByTooth = new Map<string, OdontogramEntry>();

    for (const entry of entries) {
      if (
        !entryByTooth.has(entry.toothCode) ||
        entry.surface === ToothSurface.FULL
      ) {
        entryByTooth.set(entry.toothCode, entry);
      }
    }

    rows.forEach((row, rowIndex) => {
      row.forEach((toothCode, index) => {
        const entry = entryByTooth.get(toothCode);
        const meta = entry
          ? STATUS_META[entry.status]
          : STATUS_META[ToothStatus.HEALTHY];
        const x = startX + index * 29;
        const y = startY - rowIndex * 58;

        this.rect(commands, x, y, 24, 34, meta.color);
        this.strokeRect(commands, x, y, 24, 34);
        this.text(commands, toothCode, x + 5, y + 20, 7);
        this.text(commands, entry ? meta.abbr : '', x + 6, y + 9, 7);
      });
    });
  }

  private drawLegend(commands: string[], x: number, y: number) {
    const entries = Object.entries(STATUS_META) as [
      ToothStatus,
      (typeof STATUS_META)[ToothStatus],
    ][];

    entries.forEach(([status, meta], index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const itemX = x + column * 158;
      const itemY = y - row * 18;

      this.rect(commands, itemX, itemY, 10, 10, meta.color);
      this.strokeRect(commands, itemX, itemY, 10, 10);
      this.text(
        commands,
        `${meta.abbr} ${meta.label} (${status})`,
        itemX + 16,
        itemY + 2,
        7,
      );
    });
  }

  private drawTableHeader(commands: string[], x: number, y: number) {
    this.text(commands, 'Pieza', x, y, 8);
    this.text(commands, 'Superficie', x + 42, y, 8);
    this.text(commands, 'Estado', x + 112, y, 8);
    this.text(commands, 'Tratamiento', x + 202, y, 8);
    this.text(commands, 'Observacion / descripcion', x + 320, y, 8);
    this.line(commands, x, y - 4, 560, y - 4);
  }

  private drawRows(
    commands: string[],
    entries: OdontogramEntry[],
    x: number,
    startY: number,
  ) {
    entries.forEach((entry, index) => {
      const y = startY - index * 20;

      this.text(commands, entry.toothCode, x, y, 7);
      this.text(commands, entry.surface, x + 42, y, 7);
      this.text(commands, STATUS_META[entry.status].label, x + 112, y, 7);
      this.text(commands, entry.treatmentType ?? '', x + 202, y, 7);
      this.text(
        commands,
        this.truncate(
          [entry.observation, entry.description].filter(Boolean).join(' - '),
          56,
        ),
        x + 320,
        y,
        7,
      );
    });
  }

  private buildPdf(pageContents: string[]): Buffer {
    const objects: PdfObject[] = [
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    ];
    const pageObjectIds: number[] = [];
    let nextObjectId = 3;
    const pages = pageContents.map((content) => ({
      pageId: nextObjectId++,
      contentId: nextObjectId++,
      content,
    }));
    const fontId = nextObjectId;

    for (const page of pages) {
      pageObjectIds.push(page.pageId);
      objects.push({
        id: page.pageId,
        body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${page.contentId} 0 R >>`,
      });
      objects.push({
        id: page.contentId,
        body: `<< /Length ${Buffer.byteLength(page.content, 'latin1')} >>\nstream\n${page.content}\nendstream`,
      });
    }

    objects.push({
      id: fontId,
      body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    });
    objects.splice(1, 0, {
      id: 2,
      body: `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`,
    });

    objects.sort((a, b) => a.id - b.id);

    const chunks: string[] = ['%PDF-1.4\n'];
    const offsets = [0];

    for (const object of objects) {
      offsets[object.id] = Buffer.byteLength(chunks.join(''), 'latin1');
      chunks.push(`${object.id} 0 obj\n${object.body}\nendobj\n`);
    }

    const xrefOffset = Buffer.byteLength(chunks.join(''), 'latin1');

    chunks.push(`xref\n0 ${objects.length + 1}\n`);
    chunks.push('0000000000 65535 f \n');

    for (let id = 1; id <= objects.length; id++) {
      chunks.push(`${offsets[id].toString().padStart(10, '0')} 00000 n \n`);
    }

    chunks.push(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    );

    return Buffer.from(chunks.join(''), 'latin1');
  }

  private rect(
    commands: string[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number],
  ) {
    commands.push(
      `${color[0]} ${color[1]} ${color[2]} rg ${x} ${y} ${width} ${height} re f`,
    );
  }

  private strokeRect(
    commands: string[],
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    commands.push(`0.35 0.39 0.45 RG ${x} ${y} ${width} ${height} re S`);
  }

  private line(
    commands: string[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) {
    commands.push(`0.35 0.39 0.45 RG ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  private text(
    commands: string[],
    value: string,
    x: number,
    y: number,
    size: number,
  ) {
    commands.push(
      `0 0 0 rg BT /F1 ${size} Tf ${x} ${y} Td (${this.escapeText(value)}) Tj ET`,
    );
  }

  private escapeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;

    return `${value.slice(0, maxLength - 3)}...`;
  }
}
