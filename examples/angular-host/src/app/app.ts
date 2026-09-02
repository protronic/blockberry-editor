import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import {
  createBlockBerryEditor,
  type BlockBerryEditorHandle,
} from '@protronic/blockberry-editor/embed';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements AfterViewInit, OnDestroy {
  private readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');

  protected readonly code = signal('# Editor wird initialisiert …');
  protected readonly blockCount = signal(0);
  protected readonly contentBytes = signal(0);

  private editor?: BlockBerryEditorHandle;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const host = this.editorHost().nativeElement;
    this.editor = createBlockBerryEditor({
      container: host,
      projectName: 'Angular-Demo',
      locale: 'de',
      // Served from node_modules/blockly/media via angular.json assets.
      mediaUrl: 'blockly-media/',
      onChange: (state) => {
        this.code.set(state.code);
        this.blockCount.set(state.blockCount);
        this.contentBytes.set(new TextEncoder().encode(state.content).length);
      },
    });

    const initial = this.editor.getState();
    this.code.set(initial.code);
    this.blockCount.set(initial.blockCount);
    this.contentBytes.set(new TextEncoder().encode(initial.content).length);

    this.resizeObserver = new ResizeObserver(() => this.editor?.resize());
    this.resizeObserver.observe(host);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.editor?.destroy();
    this.editor = undefined;
  }
}
