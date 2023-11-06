import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import ErrorModule from '../error';
import { ModalBodyComponent } from './components/modal/modal-body.component';
import { ModalFooterComponent } from './components/modal/modal-footer.component';
import { ModalHeaderComponent } from './components/modal/modal-header.component';

const exports = [ModalBodyComponent, ModalFooterComponent, ModalHeaderComponent];

@NgModule({
  imports: [CommonModule, ErrorModule],
  declarations: [...exports],
  exports,
})
export default class ModalModule {}
